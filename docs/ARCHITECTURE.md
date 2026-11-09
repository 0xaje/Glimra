# Glimra architecture — current implementation

Updated November 9, 2026. This file describes **the active code**. Earlier browser-frame/MediaPipe experiments have been retired.

## One real sensing pipeline

```text
Webcam, with explicit user consent
  -> @smartspectra/node-sdk native camera (Node child process)
     -> faceMetrics, stable Presage facial landmarks / blinking
     -> presageHeadMotion.cjs (centroid motion, cooldown, neutral rearming)
     -> presageNativeWorker.cjs (SDK state, quality, real gesture decisions)
     -> Electron IPC (derived direction, event type, aggregate counts only)
     -> PresageNativeController (renderer)
     -> React PDF presenter
        left / right -> previous / next PDF slide
        up / down    -> scroll inside current PDF page

Independent keyboard / mouse fallback -> PDF presentation controls
```

The runtime intentionally does **not** use MediaPipe, browser camera frames, or another gesture library. The visible PDF, page counter and controls are rendered with React and `pdfjs-dist`. The SmartSpectra requested face bundle is imported from the official SDK.

## Active files

- `src/main/main.ts`: Electron window, explicit consent gate, native worker lifecycle, permission-bound IPC, OS keychain access and fullscreen controls.
- `src/main/presageNativeWorker.cjs`: official SDK, `useCamera(CameraSelection.default)`, real `face.landmarks` and `face.blinking` packets, SDK state, gesture events and reacquisition.
- `src/main/presageHeadMotion.cjs`: small head-motion interpretation. Only sees real SDK coordinates in production. Mathematical unit tests are not application demo signals.
- `src/preload/preload.ts`: restricted `glimraDesktop` API; it does not expose raw frames, native SDK objects, or full landmark sets.
- `src/renderer/src/engine/presageNativeController.ts`: validates native event types and dispatches verified movement to the viewer.
- `src/renderer/src/App.tsx`: frontend presentation workflow, camera consent, user controls, Settings and Guide.
- `src/renderer/src/components/{SlideViewer,SlideThumbnail,PresenterHUD}.tsx`: PDF rendering and presentation UI.
- `src/renderer/src/engine/pdfEngine.ts`: PDF.js worker, page rendering and lazy thumbnails.

## Security and privacy boundaries

The native SDK owns the camera in a child process, not in the renderer. Every start/control IPC call requires explicit consent and a matching main window sender. Stop/disconnect/close terminates capture. Face coordinates and raw frames stay in the native process. The UI receives aggregate counts, quality state and derived gestures only.

API keys are entered by the presenter and saved using encrypted Electron `safeStorage` only when supported by the operating system; the app refuses plaintext fallback. The key is passed to the native child through private IPC, not a process argument, and must never appear in source, video, logs or screenshots.

The SDK is constructed with `enableTelemetry: false`. SDK authentication, metering and any other vendor network behavior should be described according to Presage's current policy; do not claim that no network activity occurs.

**Open hardening items:** the Electron BrowserWindow currently uses `sandbox: false` from an earlier renderer SDK design, so it should be reviewed and tested on Windows before enabling the sandbox. Packaging on a clean Windows computer needs a native-run smoke test; a successful CI installer build alone is not evidence that its webcam, native DLLs and child process all function.

## Current quality gates

The repository CI runs TypeScript/Vite build, Hallmark design lint, and Node unit tests, followed by Linux and Windows installer packaging. CI cannot execute a physical camera acceptance test. Windows in-app camera reliability, multi-presenter handoff, long continuous sessions, and optional real blink control must be verified separately.

The original Presage-only migration plan and the current audit are in `PRESAGE_ONLY_IMPLEMENTATION.md` and `CODEBASE_AUDIT_REPORT.md`. Historical plans and build logs may refer to discontinued architecture; do not reuse those as a description of the active application.
