import { contextBridge, ipcRenderer } from 'electron';

// Require the official SmartSpectra preload bridge
require('@smartspectra/node-sdk/preload');

// Expose Glimra presentation desktop controls
contextBridge.exposeInMainWorld('glimraDesktop', {
  toggleFullscreen: async (): Promise<boolean> => {
    return ipcRenderer.invoke('glimra:toggle-fullscreen');
  },
  isFullscreen: async (): Promise<boolean> => {
    return ipcRenderer.invoke('glimra:is-fullscreen');
  },
});
