const { contextBridge, ipcRenderer } = require("electron");
const call = (name, ...args) => ipcRenderer.invoke(`studio:${name}`, ...args);
const listen = (name, callback) => {
  const handler = (_event, value) => callback(value);
  ipcRenderer.on(`studio:${name}`, handler);
  return () => ipcRenderer.removeListener(`studio:${name}`, handler);
};
contextBridge.exposeInMainWorld(
  "studio",
  Object.freeze({
    version: "2.0.0",
    platform: process.platform,
    ready: () => call("ready"),
    library: Object.freeze({
      list: () => call("library-list"),
      load: (id) => call("library-load", id),
      save: (bytes, thumb, workspace) =>
        call("library-save", bytes, thumb, workspace),
      delete: (id) => call("library-delete", id),
      backups: () => call("library-backups"),
      backup: () => call("library-backup"),
      restore: (id) => call("library-restore", id),
    }),
    files: Object.freeze({
      open: () => call("file-open"),
      save: (bytes, title, token, hash) =>
        call("file-save", bytes, title, token, hash),
      export: (bytes, name, ext) => call("file-export", bytes, name, ext),
    }),
    onOpen: (callback) =>
      listen("open", (value) => {
        Promise.resolve(callback(value)).catch((error) =>
          console.error("Open failed", error),
        );
      }),
    onCommand: (callback) => listen("command", callback),
    onPrepare: (callback) =>
      listen("prepare", (id) => {
        Promise.resolve(callback()).then(
          () => ipcRenderer.send("studio:prepared", id, null),
          (error) =>
            ipcRenderer.send("studio:prepared", id, String(error.message)),
        );
      }),
    external: (url) => call("external", url),
    updates: Object.freeze({
      state: () => call("update-state"),
      check: () => call("update-check"),
      download: () => call("update-download"),
      install: () => call("update-install"),
      defer: () => call("update-defer"),
      activity: (safe, last) => ipcRenderer.send("studio:activity", safe, last),
      listen: (callback) => listen("update", callback),
    }),
  }),
);
