const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notificationAPI', {
  getSettings: () => ipcRenderer.invoke('notifications:getSettings'),
  saveSettings: (settings) => ipcRenderer.invoke('notifications:saveSettings', settings),
  getAccounts: () => ipcRenderer.invoke('accounts:get'),
  testNotification: () => ipcRenderer.invoke('notifications:test'),
  closeModal: () => window.close()
});
