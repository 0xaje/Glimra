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
    postMessage: (message: unknown) => void;
    onMessage: (callback: (data: unknown) => void) => void;
    close: () => void;
  };
}
