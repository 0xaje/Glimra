/// <reference types="vite/client" />

interface Window {
  glimraDesktop?: {
    startPresage: (key: string, mode: 'head' | 'eyes') => Promise<boolean>;
    stopPresage: () => Promise<boolean>;
    controlPresage: (command: 'mode' | 'pause' | 'calibration' | 'timing' | 'recenter', value: string | boolean | Record<string, number | undefined>) => Promise<boolean>;
    onPresageEvent: (listener: (event: unknown) => void) => () => void;
    toggleFullscreen: () => Promise<boolean>;
    isFullscreen: () => Promise<boolean>;
    setCameraConsent: (consent: boolean) => Promise<boolean>;
    storeApiKey: (apiKey: string) => Promise<boolean>;
    retrieveApiKey: () => Promise<string>;
    hasApiKey: () => Promise<boolean>;
  };
}
