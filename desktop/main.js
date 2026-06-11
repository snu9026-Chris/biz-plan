// =============================================================================
// main.js — Electron main process for Biz Plan Agent desktop app
//
// Lifecycle:
//   1. App boots → check config.json for auth.method
//   2. If unset → load auth.html (onboarding gate)
//   3. After auth is saved → reload as shell.html (the real app)
//   4. shell.html boots the sidebar + center iframes that wrap extension.js
//      via the vscode-shim
// =============================================================================

const { app, BrowserWindow, ipcMain, shell: electronShell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// --- Inject our shim as the resolution of require('vscode') ---
// extension.js uses `globalThis.__bizPlanVscode || require('vscode')`, so
// setting the global here is sufficient — we never even need to touch
// Module._resolveFilename.
const shim = require('./vscode-shim');
globalThis.__bizPlanVscode = shim;

let mainWindow = null;
let extensionActivated = false;

// -----------------------------------------------------------------------------
// Config (auth state) — kept separate from extension's vscode-shim config.json
// so the auth gate works even before extension.js is loaded.
// -----------------------------------------------------------------------------
function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}
function readConfig() {
  try {
    if (!fs.existsSync(configPath())) return {};
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch { return {}; }
}
function writeConfig(patch) {
  const cur = readConfig();
  const next = { ...cur, ...patch };
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(next, null, 2), 'utf8');
  return next;
}
function isAuthed() {
  const cfg = readConfig();
  if (cfg['bizPlanAgent.useClaudeCodeAuth'] === true) return true;
  const key = cfg['bizPlanAgent.anthropicApiKey'];
  return typeof key === 'string' && key.startsWith('sk-ant-') && key.length > 20;
}

// -----------------------------------------------------------------------------
// Window
// -----------------------------------------------------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1100,
    minHeight: 700,
    title: 'Biz Plan Agent',
    backgroundColor: '#0f0f1a',
    icon: path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  // Bind shim once — the shim outlives renderer reloads / page swaps.
  shim._bind({
    window: mainWindow,
    appPath: path.join(__dirname, '..'),
    userDataDir: app.getPath('userData'),
    send: (envelope) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send('host:to-shell', envelope);
    },
  });

  if (isAuthed()) {
    loadShell();
  } else {
    loadAuth();
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

function loadAuth() {
  mainWindow.loadFile(path.join(__dirname, 'auth.html'));
}

function loadShell() {
  mainWindow.loadFile(path.join(__dirname, 'shell.html'));

  // Wire extension activation once shell renderer is ready. did-finish-load
  // fires on every reload, but extension.js's activate() isn't idempotent —
  // guard with a flag that survives reloads of this window.
  const onReady = () => {
    if (extensionActivated) return;
    extensionActivated = true;
    try {
      // eslint-disable-next-line global-require
      const ext = require(path.join(__dirname, '..', 'extension.js'));
      const ctx = shim._buildContext();
      ext.activate(ctx);
      shim.commands.executeCommand('bizPlanAgent.openAgent', '00_secretary');
    } catch (e) {
      console.error('[main] extension activate failed:', e);
      dialog.showErrorBox('Extension load failed', String(e && e.stack || e));
    }
  };
  mainWindow.webContents.once('did-finish-load', onReady);
}

// -----------------------------------------------------------------------------
// IPC: extension webview ↔ extension.js (via shim)
// -----------------------------------------------------------------------------
ipcMain.on('shell:from-iframe', (_evt, payload) => {
  if (!payload || typeof payload.source !== 'string') return;
  shim._routeFromIframe(payload.source, payload.msg);
});

// -----------------------------------------------------------------------------
// IPC: auth gate
// -----------------------------------------------------------------------------

// Detect Claude Code CLI presence by spawning `claude --version`. Resolves with
// {installed, version, error}. Never throws — UI shows status either way.
function detectClaudeCli() {
  return new Promise((resolve) => {
    const bin = 'claude';
    let stdout = '';
    let stderr = '';
    let settled = false;
    const done = (val) => { if (!settled) { settled = true; resolve(val); } };

    let proc;
    try {
      proc = spawn(bin, ['--version'], { shell: true, windowsHide: true });
    } catch (e) {
      done({ installed: false, version: null, error: String(e.message || e) });
      return;
    }
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (e) => done({ installed: false, version: null, error: String(e.message || e) }));
    proc.on('close', (code) => {
      if (code === 0) {
        const m = stdout.match(/(\d+\.\d+\.\d+)/);
        done({ installed: true, version: m ? m[1] : stdout.trim().split(/\s+/)[0], error: null });
      } else {
        done({ installed: false, version: null, error: stderr.trim() || `exit ${code}` });
      }
    });
    // Hard timeout: some shells hang if `claude` isn't on PATH and `--version`
    // gets routed to a different command.
    setTimeout(() => {
      try { proc.kill(); } catch {}
      done({ installed: false, version: null, error: 'timeout' });
    }, 4000);
  });
}

ipcMain.handle('auth:detect-claude-cli', () => detectClaudeCli());

ipcMain.handle('auth:save-method', (_evt, payload) => {
  if (!payload || typeof payload.method !== 'string') {
    throw new Error('invalid payload');
  }
  if (payload.method === 'cli') {
    writeConfig({
      'bizPlanAgent.useClaudeCodeAuth': true,
      'bizPlanAgent.anthropicApiKey': '',
    });
  } else if (payload.method === 'key') {
    const key = String(payload.apiKey || '').trim();
    if (!key.startsWith('sk-ant-') || key.length < 20) {
      throw new Error('API key가 sk-ant-... 형식이어야 합니다.');
    }
    writeConfig({
      'bizPlanAgent.useClaudeCodeAuth': false,
      'bizPlanAgent.anthropicApiKey': key,
    });
  } else {
    throw new Error('unknown auth method: ' + payload.method);
  }
  return { ok: true };
});

ipcMain.on('auth:complete', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  loadShell();
});

ipcMain.on('auth:sign-out', () => {
  // Clear auth state then bounce back to onboarding. The inspector's "방법 변경"
  // button triggers this — extension state stays intact, only the credential
  // is wiped so user can pick a new one.
  writeConfig({
    'bizPlanAgent.useClaudeCodeAuth': false,
    'bizPlanAgent.anthropicApiKey': '',
  });
  extensionActivated = false;
  if (mainWindow && !mainWindow.isDestroyed()) loadAuth();
});

ipcMain.on('auth:open-external', (_evt, url) => {
  if (typeof url !== 'string') return;
  if (!/^https?:\/\//i.test(url)) return;          // never open arbitrary schemes
  electronShell.openExternal(url);
});

// Lightweight read-only probe for the floating auth pill in shell.html —
// it shows the current method ("Pro/Max" or "API") in its tooltip + label.
ipcMain.handle('auth:get-current-method', () => {
  const cfg = readConfig();
  if (cfg['bizPlanAgent.useClaudeCodeAuth'] === true) return 'cli';
  const key = cfg['bizPlanAgent.anthropicApiKey'];
  if (typeof key === 'string' && key.startsWith('sk-ant-') && key.length > 20) return 'key';
  return null;
});

// -----------------------------------------------------------------------------
// App lifecycle
// -----------------------------------------------------------------------------
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
