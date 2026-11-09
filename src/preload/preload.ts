import { contextBridge, ipcRenderer } from 'electron';

// Presage now runs natively in a consent-gated Node child process.
// Renderer has no direct camera-frame bridge or raw native metrics access.

// Expose Glimra presentation desktop controls with strictly bounded capabilities
contextBridge.exposeInMainWorld('glimraDesktop', {
  startPresage: async (key: string, mode: 'head' | 'eyes'): Promise<boolean> =>
    ipcRenderer.invoke('glimra:presage-start', key, mode),
  stopPresage: async (): Promise<boolean> =>
    ipcRenderer.invoke('glimra:presage-stop'),
  controlPresage: async (command: 'mode' | 'pause' | 'calibration' | 'timing' | 'recenter', value: string | boolean | Record<string, number | undefined>): Promise<boolean> =>
    ipcRenderer.invoke('glimra:presage-control', command, value),
  onPresageEvent: (listener: (event: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, event: unknown) => listener(event);
    ipcRenderer.on('glimra:presage-event', handler);
    return () => ipcRenderer.removeListener('glimra:presage-event', handler);
  },
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
