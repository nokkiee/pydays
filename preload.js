'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const listeners = new Set();
ipcRenderer.on('run:event', (_e, ev) => {
  for (const fn of listeners) fn(ev);
});

contextBridge.exposeInMainWorld('api', {
  detectPython: (force) => ipcRenderer.invoke('python:detect', force),
  run: (spec) => ipcRenderer.invoke('run:start', spec),
  sendStdin: (id, text) => ipcRenderer.invoke('run:stdin', id, text),
  kill: (id) => ipcRenderer.invoke('run:kill', id),
  check: (spec) => ipcRenderer.invoke('run:check', spec),
  syntax: (code) => ipcRenderer.invoke('run:syntax', code),
  onRunEvent: (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  openWorkspace: (key) => ipcRenderer.invoke('ws:open', key),
  storeGet: (key) => ipcRenderer.invoke('store:get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store:set', key, value),
  storeDel: (key) => ipcRenderer.invoke('store:del', key),
  appInfo: () => ipcRenderer.invoke('app:info'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
});
