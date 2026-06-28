'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notebookDesktop', {
  bridge: {
    info: () => ipcRenderer.invoke('bridge:get-info'),
    openApi: () => ipcRenderer.invoke('bridge:open-api'),
    onEvent: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on('bridge-event', handler);
      return () => ipcRenderer.removeListener('bridge-event', handler);
    },
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (payload) => ipcRenderer.invoke('settings:save', payload),
  },
  notebook: {
    health: () => ipcRenderer.invoke('notebook:health'),
    notebooks: () => ipcRenderer.invoke('notebook:notebooks'),
    add: (payload) => ipcRenderer.invoke('notebook:add', payload),
    select: (id) => ipcRenderer.invoke('notebook:select', id),
    update: (payload) => ipcRenderer.invoke('notebook:update', payload),
    remove: (id) => ipcRenderer.invoke('notebook:remove', id),
    sessions: () => ipcRenderer.invoke('notebook:sessions'),
    sessionAction: (payload) => ipcRenderer.invoke('notebook:session-action', payload),
    setupAuth: (payload) => ipcRenderer.invoke('notebook:setup-auth', payload),
    reauth: (payload) => ipcRenderer.invoke('notebook:reauth', payload),
    openSystemProfile: (payload) => ipcRenderer.invoke('notebook:open-system-profile', payload),
    ask: (payload) => ipcRenderer.invoke('notebook:ask', payload),
    addSource: (payload) => ipcRenderer.invoke('notebook:add-source', payload),
    audioGenerate: (payload) => ipcRenderer.invoke('notebook:audio-generate', payload),
    audioStatus: (payload) => ipcRenderer.invoke('notebook:audio-status', payload),
    audioDownload: (payload) => ipcRenderer.invoke('notebook:audio-download', payload),
  },
  logs: {
    list: (payload) => ipcRenderer.invoke('logs:list', payload),
    clear: () => ipcRenderer.invoke('logs:clear'),
  },
  content: {
    list: (payload) => ipcRenderer.invoke('content:list', payload),
    read: (payload) => ipcRenderer.invoke('content:read', payload),
  },
  updates: {
    check: () => ipcRenderer.invoke('updates:check'),
  },
  agent: {
    config: () => ipcRenderer.invoke('agent:config'),
    test: (payload) => ipcRenderer.invoke('agent:test', payload),
    chat: (payload) => ipcRenderer.invoke('agent:chat', payload),
  },
  dialog: {
    chooseDirectory: () => ipcRenderer.invoke('dialog:choose-directory'),
  },
});
