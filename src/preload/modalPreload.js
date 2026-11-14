const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('modalAPI', {
  confirmAdd: (data) => ipcRenderer.send('account:add-confirmed', data),
  confirmEdit: (data) => ipcRenderer.send('account:edit-confirmed', data),
  closeModal: () => window.close()
});
