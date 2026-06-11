// =============================================================================
// vscode-shim.js — fake `vscode` module for Electron desktop build
//
// Implements just enough of the VSCode extension API surface that extension.js
// uses (see Grep for `vscode.` in extension.js — about 20 call sites).
//
// Wiring (set by main.js before requiring extension.js):
//   - host.window      = BrowserWindow (for dialog parent + IPC)
//   - host.send(envelope) = forwards envelopes to renderer shell
//   - host.appPath     = absolute path of app root (= extensionUri.fsPath)
//   - host.userDataDir = electron app.getPath('userData') (= globalState file)
// Inbound routing (iframe → extension.js) goes through `_routeFromIframe`,
// which main.js calls directly from its ipcMain handler.
// =============================================================================

const path = require('path');
const fs = require('fs');
const { dialog, shell } = require('electron');

// Singleton wiring set by main.js
const host = {
  window: null,
  send: (envelope) => { void envelope; },
  appPath: __dirname,
  userDataDir: __dirname,
};

// Registered callbacks (populated by extension.js calling our APIs)
const reg = {
  commands: new Map(),          // id → handler
  sidebarProvider: null,        // SidebarProvider instance
  centerOnRecv: null,           // center panel's onDidReceiveMessage cb
  sidebarOnRecv: null,          // sidebar provider's onDidReceiveMessage cb
};

// ---------- ViewColumn enum (used as marker only) ----------
const ViewColumn = { One: 1, Two: 2, Beside: -2 };

// ---------- globalState backed by JSON file ----------
function globalStateFile() {
  return path.join(host.userDataDir, 'global-state.json');
}
function readGlobalState() {
  try {
    const p = globalStateFile();
    if (!fs.existsSync(p)) return {};
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { return {}; }
}
function writeGlobalState(obj) {
  try {
    fs.mkdirSync(host.userDataDir, { recursive: true });
    fs.writeFileSync(globalStateFile(), JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) { console.error('[vscode-shim] writeGlobalState failed:', e); }
}
const globalState = {
  get(key) { return readGlobalState()[key]; },
  async update(key, value) {
    const cur = readGlobalState();
    if (value === undefined) delete cur[key]; else cur[key] = value;
    writeGlobalState(cur);
  },
};

// ---------- configuration (mirrors package.json contributes.configuration) ----------
// Keep these defaults in sync with package.json's contributes.configuration.
// If you add/rename a key in package.json, mirror it here — there's no runtime
// fallback to the vsix manifest in the desktop build.
const CONFIG_DEFAULTS = {
  'bizPlanAgent.anthropicApiKey': '',
  'bizPlanAgent.useClaudeCodeAuth': true,
  'bizPlanAgent.model': 'claude-opus-4-7',
  'bizPlanAgent.workspaceFolder': 'biz-plan-results',
};
function configFile() {
  return path.join(host.userDataDir, 'config.json');
}
function readConfig() {
  try {
    if (!fs.existsSync(configFile())) return {};
    return JSON.parse(fs.readFileSync(configFile(), 'utf8'));
  } catch { return {}; }
}
function getConfiguration(section) {
  const all = readConfig();
  return {
    get(key) {
      const full = `${section}.${key}`;
      if (Object.prototype.hasOwnProperty.call(all, full)) return all[full];
      return CONFIG_DEFAULTS[full];
    },
  };
}

// ---------- workspace ----------
const workspace = {
  // On desktop we don't have an IDE-level workspace; the "workspace root" is
  // either the user-selected custom folder (via globalState.customResultsDir,
  // handled in extension.js) or the user's home directory. extension.js falls
  // back to os.homedir() when workspaceFolders is empty, so we just return [].
  workspaceFolders: [],
  getConfiguration,
  async openTextDocument(p) {
    // We don't open files in-app; we hand them to the OS default editor.
    return { _path: p };
  },
};

// ---------- window ----------
function postFromIframe(source, msg) {
  if (source === 'sidebar' && reg.sidebarOnRecv) reg.sidebarOnRecv(msg);
  else if (source === 'center' && reg.centerOnRecv) reg.centerOnRecv(msg);
}

function makeWebview(target) {
  // VSCode webview API surface we need: html (set), postMessage, onDidReceiveMessage
  const wv = {
    _html: '',
    set html(v) { this._html = v; host.send({ kind: 'setHtml', target, html: v }); },
    get html() { return this._html; },
    options: {},
    postMessage(msg) { host.send({ kind: 'post', target, msg }); },
    onDidReceiveMessage(cb) {
      if (target === 'sidebar') reg.sidebarOnRecv = cb;
      else reg.centerOnRecv = cb;
    },
  };
  return wv;
}

const window_ = {
  createWebviewPanel(viewType, title, _column, _opts) {
    const webview = makeWebview('center');
    const panel = {
      viewType, title,
      webview,
      _disposed: false,
      reveal: (_col) => host.send({ kind: 'revealCenter' }),
      onDidDispose: (cb) => { panel._onDispose = cb; },
      dispose: () => { if (!panel._disposed) { panel._disposed = true; panel._onDispose && panel._onDispose(); } },
      set title(v) { panel._title = v; host.send({ kind: 'setTitle', target: 'center', title: v }); },
      get title() { return panel._title; },
    };
    panel._title = title;
    host.send({ kind: 'createCenter', title });
    return panel;
  },
  registerWebviewViewProvider(_id, provider) {
    reg.sidebarProvider = provider;
    // Materialize the sidebar webview view immediately so resolveWebviewView fires.
    const webview = makeWebview('sidebar');
    const view = {
      webview,
      onDidDispose: () => ({ dispose: () => {} }),
    };
    queueMicrotask(() => provider.resolveWebviewView(view));
    return { dispose: () => {} };
  },
  async showInformationMessage(text, ..._items) {
    await dialog.showMessageBox(host.window || undefined, { type: 'info', message: text, buttons: ['OK'] });
    return undefined;
  },
  async showWarningMessage(text, opts, ...items) {
    // extension.js usage: showWarningMessage('Reset...', { modal: true }, 'Reset')
    const buttons = items.length ? items.concat(['Cancel']) : ['OK'];
    const r = await dialog.showMessageBox(host.window || undefined, {
      type: 'warning',
      message: text,
      buttons,
      defaultId: 0,
      cancelId: buttons.length - 1,
      modal: !!(opts && opts.modal),
    });
    return r.response < items.length ? items[r.response] : undefined;
  },
  async showOpenDialog(opts) {
    const r = await dialog.showOpenDialog(host.window || undefined, {
      title: opts.title,
      buttonLabel: opts.openLabel,
      properties: [
        opts.canSelectFiles ? 'openFile' : null,
        opts.canSelectFolders ? 'openDirectory' : null,
        opts.canSelectMany ? 'multiSelections' : null,
      ].filter(Boolean),
    });
    if (r.canceled || !r.filePaths || !r.filePaths.length) return undefined;
    return r.filePaths.map((p) => ({ fsPath: p }));
  },
  async showTextDocument(doc, _opts) {
    // Open .md in the OS default editor.
    if (doc && doc._path) await shell.openPath(doc._path);
  },
};

// ---------- commands ----------
const commands = {
  registerCommand(id, handler) {
    reg.commands.set(id, handler);
    return { dispose: () => reg.commands.delete(id) };
  },
  async executeCommand(id, ...args) {
    const h = reg.commands.get(id);
    if (!h) return;
    return await h(...args);
  },
};

// ---------- Uri ----------
const Uri = {
  file(p) { return { fsPath: p, path: p, scheme: 'file' }; },
};

// ---------- module exports ----------
module.exports = {
  // Surface used by extension.js
  workspace,
  window: window_,
  commands,
  ViewColumn,
  Uri,
  // Wiring (called by main.js)
  _bind(opts) {
    host.window = opts.window;
    host.send = opts.send;
    host.appPath = opts.appPath;
    host.userDataDir = opts.userDataDir;
  },
  _registry: reg,
  _globalState: globalState,
  _buildContext() {
    // The shape extension.js's activate(context) needs.
    return {
      subscriptions: { push: () => {} },
      globalState,
      extensionUri: { fsPath: host.appPath },
    };
  },
  _routeFromIframe: postFromIframe,
};
