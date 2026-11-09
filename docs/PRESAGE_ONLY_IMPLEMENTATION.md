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

## What has been verified and changed (November 9, 2026)

The independent *real native Presage SDK* test on the presenter's Windows webcam returned **487 decoded packets, 416 stable 478-point facial-landmark samples, 566 valid quality checks, no low-frame-rate warnings, no processing errors**, and genuine face movement (0.539 horizontal / 0.266 vertical face widths). It reported **0 detected blink starts**; Eyes is not yet proven.

The old renderer camera capture / MediaPipe head and hand tracker has now been **removed from the active code and package dependencies**. A dedicated native Node child process uses the official `@smartspectra/node-sdk` and `useCamera(CameraSelection.default)` instead. Only SDK-derived head direction, blink commands and status travel to React via bounded Electron IPC. The PDF viewer and keyboard navigation are unchanged.

**Important:** The SDK's native standalone success does not prove the new Electron-child integration works on Windows. Real Windows run and packaging verification remain necessary. The previously observed Electron renderer low-FPS error 11 / processing error 8 is avoided architecturally by no longer using the browser frame transfer route.

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

**Important:** Glimra now uses a dedicated native Node child process, not Electron's renderer or main-thread frame pump. This is implemented but still requires Windows hardware verification. Do not run another browser camera/MediaPipe loop to power gestures.

## Delivery verification

- [x] Prove genuine SmartSpectra native capture on the same Windows webcam; no dependency on MediaPipe.
- [x] Verify 478-point facial landmark payload, stable flags and real head movement ranges: **416 stable samples**, **0 SDK errors**.
- [x] Implement native SDK capture in `src/main/presageNativeWorker.cjs` and mathematical head interpreter in `src/main/presageHeadMotion.cjs`.
- [x] Bridge **only** derived command/status/count events through permission-gated Electron IPC; never send video or raw coordinates.
- [x] Render PDF page navigation and scroll exclusively from SDK-derived commands; retain keyboard fallback.
- [x] Remove old MediaPipe runtime code, dependency, and unsupported hand mode.
- [x] Implement Eyes control from genuine SDK blinking samples (actual real-world blinking response remains unverified).
- [x] Update README, Guide and consent disclosure for native camera capture and Presage.
- [ ] Confirm latest GitHub CI build and unit tests both pass; verify Windows installer contains worker source.
- [ ] Test a 5+ minute **Windows in-app native-SDK session**. Prove gentle head left/right and up/down commands, rearming, disconnect/stop, and no low-FPS/error 8 regression.
- [ ] Test actual SDK blink detection separately; prior 20-second diagnostic observed **0 blink starts**. Do not assert working Eyes until real blinks are observed.
- [ ] Record a truthful demo showing Presage metric source, real head movement, and immediate PDF effect. Never label mathematical unit-test data or keyboard control as SDK measurements.

## Pass/fail acceptance

**PASS for Presage-driven head navigation:** native SmartSpectra is running with real stable face landmarks; gentle turns change exactly one slide; up/down nods scroll only the current PDF page; no alternate sensing library drives automatic actions. **Eyes is an optional additional feature and must be verified separately before showing it in the demo.**

**FAIL:** Slides move while Presage SDK is disabled/unavailable, the only meaningful gestures are MediaPipe-driven, or the demo merely shows an API key while another detector drives the actions.

**The code is now Presage-only for automatic gesture sensing. Do not describe the full desktop product as hardware-verified or ready to submit until the new Windows integration test and CI checks have passed.**

## November 9: more comfortable control and presenter handoff (native Presage only)

**Windows terminal evidence supplied by the presenter:** Presage's native child started two real capture sessions, showing internal MediaPipe/TFLite implementation warnings, landmark-projection warnings and Windows Media Foundation camera exposure fallbacks. There was **no reported SmartSpectra error 8, kError, or JavaScript fatal error** in the pasted log. The application initially responded comfortably; response became inconsistent when a different person attempted to present. Native warnings do not prove that the landmark stream stopped.

**Confirmed design limitations in the previous Glimra code:**
- The head-motion engine kept the first presenter's face-centroid reference. A new presenter's offset could be read as one large gesture and leave the engine disarmed until they returned to someone else's original position.
- The renderer used a cumulative valid-landmark count as a signal of face readiness. That number can remain positive after face tracking stops, producing a misleading "ready" state.
- Validation warnings were sent to React on nearly every bad frame, creating unnecessary UI updates.
- Native camera capture has **no video preview** in React by design. Do not open a second getUserMedia stream to fake a preview.

**Applied corrections:**
- Track sudden face-position or face-size discontinuities and rebaseline without sending a slide command. Respect the SDK's actual `Landmarks.reset` and no/multiple-face validation.
- If the user has settled in a new pose for about 1.1 seconds after a gesture, rearm from that pose **without repeating the command**. This avoids forced neck movements or pixel-perfect returns. Gently lower head movement thresholds while retaining two successive consistent readings.
- Keep a live face-tracked indicator based on fresh *Presage SDK* metrics. An SDK process may run while face tracking is unavailable; do not show a stale "Head ready".
- Throttle duplicate warnings; warn for multiple faces and insufficient light without mislabeling them a fatal SDK crash.
- Offer a small **Recenter for a new presenter** recovery action under camera setup. Automatic reacquisition remains the primary flow.

**Recommended capture conditions:** one person at a time; the previous presenter should step completely out of view before the next person steps in. Light the face evenly, avoid strong backlighting, keep camera stable, and avoid extreme head turns. Presage's model card explicitly warns that large rotations reduce facial landmark reliability. The Media Foundation exposure warning reports a camera driver reverting to AUTO; it does **not** by itself mean Glimra is malfunctioning.

**Hand swipe policy:** SmartSpectra's published face metrics do not provide hand-landmark coordinates. Per the strict Presage-only requirement, do not reintroduce MediaPipe/OpenCV hand tracking or describe hand control as SmartSpectra functionality. Keyboard/mouse controls are allowed accessibility fallbacks; Eyes remains an optional genuine Presage blink mode, not yet shown to detect real blinks in the previous standalone diagnostic.

**Verification pending:** GitHub CI math tests plus a live Windows presentation involving two presenters, small up/down and left/right gestures, and a 5+ minute continuous session. No real hand gestures or second-presenter success should be claimed before that test.
