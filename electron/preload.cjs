const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApi', {
  getState: () => ipcRenderer.invoke('monitor:get-state'),
  getLogs: () => ipcRenderer.invoke('monitor:get-logs'),
  startServer: () => ipcRenderer.invoke('monitor:start-server'),
  stopServer: () => ipcRenderer.invoke('monitor:stop-server'),
  restartServer: () => ipcRenderer.invoke('monitor:restart-server'),
  openPlayer: () => ipcRenderer.invoke('monitor:open-player'),
  openAdmin: () => ipcRenderer.invoke('monitor:open-admin'),
  openSettings: () => ipcRenderer.invoke('monitor:open-settings'),
  showLogFile: () => ipcRenderer.invoke('monitor:show-log-file'),
  getConfig: () => ipcRenderer.invoke('monitor:get-config'),
  saveConfig: (config) => ipcRenderer.invoke('monitor:save-config', config),
  minimizeWindow: () => ipcRenderer.invoke('monitor:window-minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('monitor:window-toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('monitor:window-close'),
  quitApp: () => ipcRenderer.invoke('monitor:quit-app'),
  onStateChanged: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('monitor:state', handler);
    return () => ipcRenderer.removeListener('monitor:state', handler);
  }
});