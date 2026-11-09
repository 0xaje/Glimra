# Glimra — strict Presage-first challenge implementation contract

**Date:** November 9, 2026  
**Status:** Required direction confirmed; **migration in progress, not yet verified in the app**.

## Non-negotiable rules

1. Presage SmartSpectra is the **only automatic human-sensing source** for the challenge build. The camera is captured and processed through the official SDK. No MediaPipe, OpenCV, browser face tracker, synthetic head landmarks, dummy blink signal, or alternative sensor engine can silently issue presentation commands.
2. Genuine SDK data must be **the cause** of each automatic action, not background telemetry running alongside a different gesture detector.
3. Glimra may use React/Electron to display UI, PDF.js to render PDFs, and ordinary mouse/keyboard buttons as accessibility fallbacks. Those are not alternative human-sensing systems.
4. Keep complete, truthful consent and data-handling explanations. Users opt into live camera use; never record raw frames, fake success, store biometric samples, or log API keys. SDK telemetry must be disclosed; if disabled, state so accurately.
5. A mode unsupported by the official SDK must **not** appear as an official SDK-powered control. Hand landmarks are **not in the published SmartSpectra metric list**. Do not make hand swipes a headline feature or run them through a different tracker in a supposed Presage-only demo.
6. There must be no paid automatic retry loop after SDK error 8. Error 8 is `kProcessingFailed`; code 11 is low frame-rate validation, not a credential problem.

## What Presage itself supports

Official `MetricType` definitions include:
- `FACE_LANDMARKS` (11): 478 x/y facial points, stability/reset/timestamps. Used to derive **small head turns/nods** by Glimra's simple coordinate calculations.
- `BLINKING` (12): actual eye blink observations, used for deliberate blink navigation.
- `TALKING` (13) and `EXPRESSIONS` (14): optional real SDK features; do not call a derivative gesture one of these raw classifications.
- Pulse, breathing and HRV: genuinely supported but **not needed** merely to satisfy the challenge.

The official face-analysis model card says tracking degrades with significantly rotated/nonfrontal faces. Design for **small comfortable head movements**. Do not promise arbitrarily large nods.

Sources:
- https://dev.to/challenges/presage-2026-11-04/
- https://presagetech.com/docs/smartspectra-sdk/nodejs
- https://presagetech.com/docs/smartspectra-sdk/nodejs/metrics
- https://presagetech.com/docs/smartspectra-sdk/data-types
- https://presagetech.com/docs/smartspectra-sdk/model-cards-and-limitations

## Why the current product must change

The current default Head/Hands flow opens `getUserMedia()` in the renderer and gets commands from `@mediapipe/tasks-vision`. SmartSpectra is started only in the optional Eyes mode. This is a valid general-purpose desktop experience, but **the default head navigation is NOT powered by Presage** and must not be submitted as such.

The Electron renderer-based SmartSpectra path repeatedly received low-FPS code 11 and processing error 8. Yet **the same computer's native Node SmartSpectra camera path was successful**: 495 metrics callbacks, 508 valid SDK checks, no low-FPS warnings, no SDK errors. This suggests testing the native camera path first, not adding more concurrent frame processors.

## Target architecture (Presage-only sensing)

```text
Camera (with explicit user permission)
  -> @smartspectra/node-sdk, native useCamera(CameraSelection.default)
     -> real SDK metrics.face.landmarks[] (stable, reset, timestamps)
         -> Glimra small movement interpreter
            -> head left/right -> previous/next slide
            -> head up/down -> scroll this PDF page
     -> real SDK metrics.face.blinking[]
         -> intentional blink interpreter -> slide action
     -> real SDK validationStatus / processingStatus
         -> show live status; disallow commands on invalid/stale readings
  -> Electron IPC transfers only derived commands/quality state
  -> React UI + PDF.js presentation viewer
```

Use the **native camera capture path**, which worked in the user's independent Windows test, rather than the frame-hungry renderer `MediaStreamTrackProcessor` + `OffscreenCanvas` + IPC pixel pump. The official docs support `@smartspectra/node-sdk` with `useCamera(CameraSelection.default)` in Node/Electron and explicitly note extra renderer-to-main frame-transfer latency.

**Important:** Running the native SDK inside Electron's main process is not identical to standalone Node, so still test it on Windows before calling it a fix. Prefer a dedicated supervised native Node child process if the Electron main process cannot reliably handle long capture, while still using the official SDK end-to-end. Do not open an additional webcam capture/MediaPipe loop to feed head gestures.

## Safe delivery order

- [x] Independently verify real native SDK processing on the user's hardware (previously successful).
- [x] Add `scripts/check-presage-live-facial-signals.cjs` to verify real `face.landmarks[].value`, stability, blinks, and comfortable movement ranges without MediaPipe. **Script added; real output still pending.**
- [ ] Verify that script on the user's Windows webcam. Confirm genuine decoded landmark points and timing; do not assume SDK's point order equals MediaPipe's.
- [ ] Implement a native-SDK-only capture service and small secure IPC bridge. Never log the API key, full face coordinates or raw frames. Stop/restart safely.
- [ ] Feed actual Presage landmark packets into a simple, tested head-motion interpreter. Maintain PDF-only up/down scrolling, single-trigger/re-arm, and gentle threshold behavior.
- [ ] Drive blink commands only from actual SDK blink samples; keep SmartSpectra always active in the automatic-gesture mode.
- [ ] Remove `@mediapipe/tasks-vision` and all `LiveGestureTracker` runtime imports; remove or clearly disable unsupported hand-tracking claims.
- [ ] Verify `npm run build` and `npm test` on Windows; run 5+ minutes of real slides and scrolling on live camera without restarting. Record SDK metrics/validation, actual actions and any errors.
- [ ] Make demo show **one actual SDK packet -> recognized signal -> immediate PDF interaction**. Add a short user-facing diagnostic showing the SDK signal source, without raw physiological data.
- [ ] Update README, Guide, privacy disclosure and challenge submission to make only truthful verified statements.

## Pass/fail acceptance

**PASS:** Presage is running; real face landmarks are received; a gentle head turn changes exactly one slide, an up/down nod scrolls only the current PDF page, a real blink controls an optional action, and no alternate sensing library is involved.

**FAIL:** Slides move while Presage SDK is disabled/unavailable, the only meaningful gestures are MediaPipe-driven, or the demo merely shows an API key while another detector drives the actions.

**Do not describe current Glimra as Presage-only or fully challenge-compliant until the above integration and real hardware tests are completed.**
