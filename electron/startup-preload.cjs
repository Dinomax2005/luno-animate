const { contextBridge, ipcRenderer } = require('electron');
// No library, document, updater, file-system, shell, or arbitrary IPC access here.
contextBridge.exposeInMainWorld('lunoStartup', Object.freeze({
  version: '0.4.0',
  onState: callback => { const handler = (_event, state) => callback(state); ipcRenderer.on('luno:startup-state', handler); return () => ipcRenderer.removeListener('luno:startup-state', handler); },
  retry: () => ipcRenderer.send('luno:startup-action', 'retry'),
  quit: () => ipcRenderer.send('luno:startup-action', 'quit'),
}));
