const { contextBridge, ipcRenderer } = require('electron');
const subscribe = (channel, callback) => {
  const handler = (_event, value) => callback(value);
  ipcRenderer.on(channel, handler); return () => ipcRenderer.removeListener(channel, handler);
};
contextBridge.exposeInMainWorld('luno', {
  platform: process.platform, version: '0.3.5',
  documents: { open: () => ipcRenderer.invoke('luno:document-open'), save: (token, data) => ipcRenderer.invoke('luno:document-save', token, data), saveAs: (data, name) => ipcRenderer.invoke('luno:document-save-as', data, name) },
  saveProject: (data, name) => ipcRenderer.invoke('luno:save-project', data, name),
  openProject: () => ipcRenderer.invoke('luno:open-project'),
  saveExport: (bytes, name, extension) => ipcRenderer.invoke('luno:save-export', bytes, name, extension),
  chooseFolder: () => ipcRenderer.invoke('luno:choose-folder'), getWorkspace: () => ipcRenderer.invoke('luno:get-workspace'),
  onCommand: callback => subscribe('luno:command', callback), onProjectFile: callback => subscribe('luno:project-file', callback), ready: () => ipcRenderer.invoke('luno:ready'),
  library: {
    list: () => ipcRenderer.invoke('luno:library-list'), save: (bytes, thumbnail) => ipcRenderer.invoke('luno:library-save', bytes, thumbnail), load: id => ipcRenderer.invoke('luno:library-load', id),
    patch: (id, patch) => ipcRenderer.invoke('luno:library-patch', id, patch), deleteForever: id => ipcRenderer.invoke('luno:library-delete', id), recover: id => ipcRenderer.invoke('luno:library-recover', id),
    getSettings: () => ipcRenderer.invoke('luno:settings-get'), saveSettings: settings => ipcRenderer.invoke('luno:settings-save', settings),
    backups: () => ipcRenderer.invoke('luno:backups-list'), backup: () => ipcRenderer.invoke('luno:backup-create'), restore: id => ipcRenderer.invoke('luno:backup-restore', id),
  },
  updater: {
    state: () => ipcRenderer.invoke('luno:update-state'), check: () => ipcRenderer.invoke('luno:update-check'), install: () => ipcRenderer.invoke('luno:update-install'), defer: () => ipcRenderer.invoke('luno:update-defer'),
    setAutomatic: enabled => ipcRenderer.invoke('luno:update-automatic', enabled), activity: value => ipcRenderer.send('luno:activity', value), onState: callback => subscribe('luno:update-state', callback),
  },
  onPrepare: callback => subscribe('luno:prepare', callback), preparationResult: (id, ok, error) => ipcRenderer.send('luno:prepared', { id, ok, error }), onResume: callback => subscribe('luno:resume', callback),
});
