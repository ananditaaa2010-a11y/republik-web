const { contextBridge, ipcRenderer } = require('electron');

const api = {
  getAccounts: () => ipcRenderer.invoke('accounts:get'),
  openAddAccountModal: () => ipcRenderer.invoke('accounts:openAddModal'),
  switchAccount: (id) => ipcRenderer.invoke('accounts:switch', id),
  addAccount: (name, color) => ipcRenderer.invoke('accounts:add', name, color),
  renameAccount: (id, name) => ipcRenderer.invoke('accounts:rename', id, name),
  removeAccount: (id) => ipcRenderer.invoke('accounts:remove', id),
  reloadAccount: (id) => ipcRenderer.invoke('accounts:reload', id),
  openDevTools: (id) => ipcRenderer.invoke('accounts:openDevTools', id),
  showAccountContextMenu: (id) => ipcRenderer.invoke('accounts:showContextMenu', id),
  openAutoTextModal: () => ipcRenderer.invoke('autotext:openModal'),
  openHelpModal: () => ipcRenderer.invoke('app:openHelp'),
  openPrivacyBlurModal: () => ipcRenderer.invoke('privacy:openModal'),
  getPrivacySettings: () => ipcRenderer.invoke('privacy:getSettings'),
  savePrivacySettings: (settings) => ipcRenderer.invoke('privacy:saveSettings', settings),
  lockNow: () => ipcRenderer.invoke('privacy:lockNow'),
  toggleBlur: () => ipcRenderer.send('view:toggle-blur'),
  openNotificationModal: () => ipcRenderer.invoke('notifications:openModal'),
  getNotificationSettings: () => ipcRenderer.invoke('notifications:getSettings'),
  saveNotificationSettings: (settings) => ipcRenderer.invoke('notifications:saveSettings', settings),
  testNotification: () => ipcRenderer.invoke('notifications:test'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onUpdaterStatus: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('updater:status', subscription);
    return () => ipcRenderer.removeListener('updater:status', subscription);
  },

  onBadgeUpdate: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('account:badge-updated', subscription);
    return () => ipcRenderer.removeListener('account:badge-updated', subscription);
  },

  onAccountsChanged: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('accounts:changed', subscription);
    return () => ipcRenderer.removeListener('accounts:changed', subscription);
  },

  onNotificationSettingsChanged: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('notifications:settingsChanged', subscription);
    return () => ipcRenderer.removeListener('notifications:settingsChanged', subscription);
  }
};

contextBridge.exposeInMainWorld('republikAPI', api);
