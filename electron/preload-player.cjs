const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('playerDesktopApi', {
  loadIdentity: (instanceId) => ipcRenderer.invoke('player:identity-load', instanceId),
  saveIdentity: (instanceId, payload) => ipcRenderer.invoke('player:identity-save', instanceId, payload),
  loadSettings: () => ipcRenderer.invoke('player:settings-load'),
  saveSettings: (payload) => ipcRenderer.invoke('player:settings-save', payload),
  applySettings: () => ipcRenderer.invoke('player:settings-apply')
});