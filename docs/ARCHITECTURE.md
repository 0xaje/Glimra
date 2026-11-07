# ARCHITECTURE.md — Glimra System Architecture

## 1. System Overview

Glimra is a hands-free desktop presentation tool built with Electron, React, TypeScript, and Vite, leveraging the Presage SmartSpectra SDK for contact-free optical physiological and facial detection.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Glimra Desktop App                              │
├──────────────────────────────────────┬──────────────────────────────────────┤
│           Renderer Process           │             Main Process             │
│  (React UI + PDF Presentation View)  │         (Electron Host / FFI)        │
├──────────────────────────────────────┼──────────────────────────────────────┤
│                                      │                                      │
│  ┌──────────────────────────────┐    │    ┌────────────────────────────┐    │
│  │   Presentation Engine (PDF)  │    │    │   Electron BrowserWindow   │    │
│  │   - pdfjs-dist renderer      │    │    │   - Window management      │    │
│  │   - Fullscreen controller    │    │    │   - File dialogs           │    │
│  │   - Keyboard fallback        │    │    │   - Secure storage         │    │
│  └──────────────┬───────────────┘    │    └─────────────┬──────────────┘    │
│                 │                    │                  │                   │
│  ┌──────────────▼──────────────┐     │                  │                   │
│  │    Gesture Interpreter      │     │                  │                   │
│  │    - Dwell / Blink filter   │     │                  │                   │
│  │    - Debounce & calibration │     │                  │                   │
│  │    - Safelight HUD feedback │     │                  │                   │
│  └──────────────▲──────────────┘     │                  │                   │
│                 │                    │                  │                   │
│  ┌──────────────┴──────────────┐     │    ┌─────────────▼──────────────┐    │
│  │  SmartSpectra Renderer SDK  │◄────┼───►│  SmartSpectra Main Bridge  │    │
│  │  - getUserMedia() capture   │ IPC │    │  - bindSmartSpectraIpc()   │    │
│  │  - decodeMetrics() (Proto)  │     │    │  - koffi native runtime    │    │
│  └─────────────────────────────┘     │    │  - libsmartspectra_capi    │    │
│                                      │    └─────────────┬──────────────┘    │
│                                      │                  │                   │
└──────────────────────────────────────┴──────────────────┼───────────────────┘
                                                          │ HTTPS / WSS
                                            ┌─────────────▼──────────────┐
                                            │ Presage Physiology Backend │
                                            │ (Auth & Metric Processing) │
                                            └────────────────────────────┘
```

---

## 2. Process Separation & Security

- **Context Isolation & Sandbox:**
  - The renderer process runs with `contextIsolation: true` and `sandbox: true`.
  - No direct Node.js primitives or native C++ modules are loaded in the renderer.
  - The `@smartspectra/node-sdk/preload` bridge securely connects the renderer frame pump to the main process via sanitized IPC.
- **Credential Storage:**
  - The Presage API key is never committed to Git or hardcoded in client bundles.
  - User-provided credentials are encrypted locally via Electron's `safeStorage` API (DPAPI on Windows, Keychain on macOS, libsecret on Linux).
  - Renderer requests authentication status through IPC without exposing raw keys in unencrypted web storage.

---

## 3. Gesture Interpretation Pipeline

1. **Frame Capture:** The renderer acquires video frames through standard HTML5 `MediaStream` (`navigator.mediaDevices.getUserMedia`).
2. **Signal Extraction:** Frames are processed by SmartSpectra's facial detection model, generating Metric 12 (`BLINKING`) timestamps and confidence markers.
3. **Intentionality Filter:**
   - **Involuntary Blink Rejector:** Natural spontaneous blinks (typically 100ms–250ms) are filtered out.
   - **Hold / Dwell Recognition:** An intentional eye gesture requires a sustained closed state exceeding a calibrated threshold (e.g., 400ms–700ms).
   - **Cooldown / Refractory Period:** Once an intentional command triggers (e.g. Next Slide), a 1000ms cooldown prevents double-stepping.
4. **Visual Safelight HUD:** A subtle safelight indicator in the viewport provides instantaneous visual confirmation of gesture state without distracting the audience.
5. **Keyboard Fallback:** Physical keyboard commands (`ArrowRight`, `ArrowLeft`, `Space`, `Escape`) always take absolute priority.
