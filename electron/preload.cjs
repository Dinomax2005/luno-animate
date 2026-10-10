const { contextBridge, ipcRenderer } = require('electron');
const subscribe = (channel, callback) => {
  const handler = (_event, value) => callback(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};
contextBridge.exposeInMainWorld('luno', {
  platform: process.platform,
  version: '0.1.0',
  saveProject: (data, name) => ipcRenderer.invoke('luno:save-project', data, name),
  openProject: () => ipcRenderer.invoke('luno:open-project'),
  saveExport: (bytes, name, extension) => ipcRenderer.invoke('luno:save-export', bytes, name, extension),
  chooseFolder: () => ipcRenderer.invoke('luno:choose-folder'),
  getWorkspace: () => ipcRenderer.invoke('luno:get-workspace'),
  onCommand: callback => subscribe('luno:command', callback),
  onProjectFile: callback => subscribe('luno:project-file', callback),
  ready: () => ipcRenderer.invoke('luno:ready'),
});
