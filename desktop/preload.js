// preload.js — bridges shell renderer ↔ main process via contextBridge.
const { contextBridge, ipcRenderer } = require('electron');

// ---- shell.html: extension webview pane bridge ----
contextBridge.exposeInMainWorld('electronHost', {
  onHostMessage: (cb) => {
    ipcRenderer.on('host:to-shell', (_e, envelope) => cb(envelope));
  },
  sendToHost: (source, msg) => {
    ipcRenderer.send('shell:from-iframe', { source, msg });
  },
});

// ---- auth.html (onboarding) + shell.html (floating auth pill) bridge ----
contextBridge.exposeInMainWorld('electronAuth', {
  detectClaudeCli: () => ipcRenderer.invoke('auth:detect-claude-cli'),
  saveAuthMethod: (payload) => ipcRenderer.invoke('auth:save-method', payload),
  completeAuth: () => ipcRenderer.send('auth:complete'),
  signOut: () => ipcRenderer.send('auth:sign-out'),
  openExternal: (url) => ipcRenderer.send('auth:open-external', url),
  getCurrentMethod: () => ipcRenderer.invoke('auth:get-current-method'),
});
