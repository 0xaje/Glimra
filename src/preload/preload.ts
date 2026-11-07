import { contextBridge, ipcRenderer } from 'electron';

// Require the official SmartSpectra preload bridge
require('@smartspectra/node-sdk/preload');

// Expose Glimra presentation desktop controls with strictly bounded capabilities
contextBridge.exposeInMainWorld('glimraDesktop', {
  toggleFullscreen: async (): Promise<boolean> => {
    return ipcRenderer.invoke('glimra:toggle-fullscreen');
  },
  isFullscreen: async (): Promise<boolean> => {
    return ipcRenderer.invoke('glimra:is-fullscreen');
  },
  setCameraConsent: async (consent: boolean): Promise<boolean> => {
    return ipcRenderer.invoke('glimra:set-camera-consent', consent);
  },
  storeApiKey: async (apiKey: string): Promise<boolean> => {
    return ipcRenderer.invoke('glimra:store-api-key', apiKey);
  },
  retrieveApiKey: async (): Promise<string> => {
    return ipcRenderer.invoke('glimra:retrieve-api-key');
  },
  hasApiKey: async (): Promise<boolean> => {
    return ipcRenderer.invoke('glimra:has-api-key');
  },
});
