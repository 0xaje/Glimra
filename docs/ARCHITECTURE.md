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
│  │   - Fullscreen controller    │    │    │   - Origin permission gate │    │
│  │   - Keyboard fallback        │    │    │   - safeStorage encryption │    │
│  └──────────────┬───────────────┘    │    └─────────────┬──────────────┘    │
│                 │                    │                  │                   │
│  ┌──────────────▼──────────────┐     │                  │                   │
│  │    Gesture Interpreter      │     │                  │                   │
│  │    - Dwell / Blink filter   │     │                  │                   │
│  │    - Stability gating       │     │                  │                   │
│  │    - Timestamp validation   │     │                  │                   │
│  │    - Refractory cooldown    │     │                  │                   │
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

## 2. Process Separation & Security Architecture

### Context Isolation & Sandbox Boundary
- **`contextIsolation: true` (Strictly Enforced):** The renderer execution context is strictly segregated from the preload script. The renderer has zero access to Electron internals, Node.js global objects, or prototype modifications.
- **`nodeIntegration: false` (Strictly Enforced):** Renderer JavaScript cannot call `require()`, access `process`, or interact with filesystem APIs.
- **`sandbox: false` Rationale & Mitigations:**
  - *Why `sandbox: false` is used:* The official `@smartspectra/node-sdk/preload` bridge requires access to preload-level MessageChannel native transfer and diagnostic environment variables (`process.env.SMARTSPECTRA_DIAGNOSTICS`).
  - *Defense-in-depth mitigations:*
    1. Capabilities exposed to the renderer via `contextBridge.exposeInMainWorld('glimraDesktop')` are strictly typed, bounded, and validate input parameters before passing to IPC.
    2. Camera hardware access (`setPermissionRequestHandler`) strictly verifies that the requesting webContents origin matches trusted local origins (`file://`, `http://localhost:5173`) and denies any untrusted or remote web origin.
    3. Camera hardware access requires **explicit presenter consent**; requests are rejected by the main process until the presenter clicks "Enable camera control".

### Credential Safeguards
- **Zero Hardcoded Secrets:** The repository and distributed packages contain zero developer API keys or embedded credentials.
- **OS-Level SafeStorage:** User-provided Presage API keys are saved exclusively via Electron's `safeStorage` API (using Windows DPAPI, macOS Keychain, or Linux libsecret/KWallet).
- **No LocalStorage Persistence:** Sensitive tokens are never stored in browser `localStorage`, preventing exposure to XSS or third-party web script inspection.
- **No Credential Logging:** API keys are never output to stdout/stderr, diagnostic files, or crash dumps.

---

## 3. Gesture Interpretation Pipeline

### Physiological Problem Definition
Human involuntary (spontaneous) blinks last 100ms–250ms at a frequency of 12–20 blinks per minute. Feeding raw blink events directly to slide navigation would cause uncontrollable slide skipping.

### Deterministic Multi-Stage Filter (`src/renderer/src/engine/gestureEngine.ts`)

1. **Timestamp Monotonicity & Stall Protection:**
   - Drops duplicate or non-monotonic timestamps (`deltaUs <= 0`).
   - If timestamp gaps exceed 2 seconds (e.g., video stutter or thread freeze), transient dwell states are reset immediately to prevent artificial long-duration blinks.
2. **Stability Gating:**
   - Evaluates `stable: boolean` from SmartSpectra's `IDetectionStatus`.
   - Samples marked `stable === false` (e.g. during sudden head turns, lighting flicker, or motion blur) are discarded immediately and cannot charge or commit gesture triggers.
3. **Intentional Dwell Gating:**
   - A single blink must be sustained between **350ms and 850ms** to register as an intentional slide advance command (`next`).
   - Closures lasting < 250ms are identified as spontaneous involuntary blinks and discarded.
   - Closures lasting > 850ms (resting eyes, reading physical notes) are discarded without triggering slide navigation.
4. **Verified Double-Blink Sequence:**
   - Double-blink for slide rewinding (`prev`) requires two deliberate rapid voluntary closures:
     - Each sub-blink must be between **100ms and 280ms**.
     - Inter-blink interval must be between **80ms and 450ms**.
     - If either blink exceeds 280ms or the interval falls outside the window, the double-blink candidate is cleared.
5. **Post-Trigger Refractory Cooldown:**
   - Enforces a mandatory **1200ms refractory lockout period** after every executed command, preventing inadvertent double-advancing.
6. **Lost Tracking & Presenter Pause Immediate Disarm:**
   - When face tracking is lost (`kNoFaceFound`, `kFaceNotCentered`) or the presenter toggles pause (`Space` or `P`), all active dwell timers and double-blink states are reset to 0 immediately.

---

## 4. Presentation Viewer Architecture

- Built on Mozilla's `pdfjs-dist` (v4+ ES modules).
- Presentation pages are rendered onto an HTML5 `<canvas>` with device pixel ratio scaling (retina display support).
- Centered letterbox layout preserves 16:9 and 4:3 slide geometry without distortion.
- Operates 100% offline with zero cloud dependencies for document viewing.
