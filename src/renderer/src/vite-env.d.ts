/// <reference types="vite/client" />

interface Window {
  glimraDesktop?: {
    toggleFullscreen: () => Promise<boolean>;
    isFullscreen: () => Promise<boolean>;
    setCameraConsent: (consent: boolean) => Promise<boolean>;
    storeApiKey: (apiKey: string) => Promise<boolean>;
    retrieveApiKey: () => Promise<string>;
    hasApiKey: () => Promise<boolean>;
  };
  __smartspectraBridge?: {
    diagnostics: boolean;
    attach: () => void;
    postMessage: (message: any) => void;
    onMessage: (callback: (data: any) => void) => void;
    close: () => void;
  };
}
