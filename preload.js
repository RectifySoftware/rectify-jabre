const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rj', {
  version: process.env.npm_package_version || null,

  login: (creds) => ipcRenderer.invoke('auth:login', creds),
  demoAgents: () => ipcRenderer.invoke('auth:demoAgents'),

  onSessionInit: (cb) => ipcRenderer.on('session:init', (evt, session) => cb(session)),

  searchFlights: (origin, dest, date, currency) => ipcRenderer.invoke('flights:search', { origin, dest, date, currency }),

  getRates: () => ipcRenderer.invoke('currency:getRates'),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  clearSettings: () => ipcRenderer.invoke('settings:clear'),
  testApiConnection: (settings) => ipcRenderer.invoke('settings:testConnection', settings),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  checkForUpdates: () => ipcRenderer.invoke('update:checkNow'),

  savePnr: (pnr) => ipcRenderer.invoke('pnr:save', pnr),
  getPnr: (locator) => ipcRenderer.invoke('pnr:get', locator),
  listPnrs: () => ipcRenderer.invoke('pnr:list'),
  deletePnr: (locator) => ipcRenderer.invoke('pnr:delete', locator),
  printPnr: (pnr) => ipcRenderer.invoke('pnr:print', pnr)
});
