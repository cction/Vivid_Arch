const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('banana', {
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
  },
});
