const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('privacyAPI', {
  getSettings: () => ipcRenderer.invoke('privacy:getSettings'),
  saveSettings: (settings) => ipcRenderer.invoke('privacy:saveSettings', settings),
  lockNow: () => ipcRenderer.invoke('privacy:lockNow'),
  resetDefaults: () => ipcRenderer.invoke('privacy:resetDefaults'),
  closeModal: () => ipcRenderer.send('privacy:closeModal')
});
