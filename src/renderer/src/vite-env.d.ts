/// <reference types="vite/client" />

interface Window {
  glimraDesktop?: {
    toggleFullscreen: () => Promise<boolean>;
    isFullscreen: () => Promise<boolean>;
  };
  __smartspectraBridge?: {
    diagnostics: boolean;
    attach: () => void;
    postMessage: (message: any) => void;
    onMessage: (callback: (data: any) => void) => void;
    close: () => void;
  };
}
