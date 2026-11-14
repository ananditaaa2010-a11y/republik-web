const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('autoTextAPI', {
  getAll: () => ipcRenderer.invoke('autotext:get'),
  save: (item) => ipcRenderer.invoke('autotext:save', item),
  delete: (id) => ipcRenderer.invoke('autotext:delete', id),
  resetDefaults: () => ipcRenderer.invoke('autotext:reset'),
  closeModal: () => window.close()
});
