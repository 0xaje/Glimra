# Live head and hand gesture verification

This integration uses the **real camera stream** already opened for SmartSpectra. MediaPipe's face and hand models run on video frames in the Electron renderer. Model/WASM assets are downloaded from Google Storage/jsDelivr on first use; an internet connection is required for that download. SmartSpectra remains active for genuine physiological/blink measurements. Neither SDK output nor hand/head landmarks are simulated.

## Install

From the Glimra repository on Windows:

```powershell
git switch main
git pull origin main
npm install
npm run build
npm test
npm run dev
```

**Important:** `package.json` now includes `@mediapipe/tasks-vision`, but the existing committed `package-lock.json` has not yet been regenerated. Run `npm install` (not `npm ci`) to update the lockfile, and commit the resulting lockfile after validating the installation.

## Real comfortable head-first presentation checks

1. Pull `main`, run `npm run build` and `npm test`, open a PDF with at least three pages, and enable camera consent.
2. **Head is the default** even after an earlier installation selected Hands. The new preference key allows a fresh default. Wait for `[Glimra/Gestures] Real head tracking ready`.
3. Sit comfortably, even if you are not in the center of the camera frame. Glimra learns the first natural face pose as neutral. Gently look/tilt right then return to your relaxed pose. Confirm one next-slide action, not repeated triggers. Then gently move left for previous.
4. On a **tall page** (or a page with Zoom in / Fit width), make a small nod down to scroll **only the current PDF page**; nod up to scroll back. The current slide number MUST remain unchanged.
5. If no scrolling occurs, verify first that Arrow Down/Up actually scrolls the PDF. A PDF page fully visible in the viewport has nowhere to scroll until zoomed.
6. Select **Hands** in Settings to use open-palm left/right swipes for slides, up/down for PDF-only scrolling. Hand mode is still optional; its sensitivity is separate from Head.
7. Select **Eyes** only to use original SmartSpectra long-blink/double-blink navigation. Blink navigation is disabled in Head/Hands modes, but SmartSpectra continues processing genuine SDK metrics.
8. Check no navigation during a brief face loss, blinking or while paused. No idle timeout should disconnect the camera. An SDK error must be recorded and not mistaken for a valid physiological signal.
9. In the demo screen recording, `npm test` passed 22 tests and navigating PDF pages was visibly working; some Node module / PDF indexing **warnings** appeared, but these warnings alone are not proof of a camera failure.

## November 9 regression review — recorded video 12:50

The user reported that the new face-pose tracking felt worse than the earlier working release. The 3m18s Windows recording confirms PDF navigation and in-page scrolling can occur, but intentional head turns were not consistently recognized. The camera preview and UI remained active. The DevTools console showed:
- `[Glimra] SmartSpectra error (8, retryable=true): SmartSpectra processing failed`
- `A VideoFrame was garbage collected without being closed` (ownership not identified by the log)
- `INFO: Created TensorFlow Lite XNNPACK delegate for CPU` (informational log, **not** a fatal TensorFlow error)

The expanded gesture HUD covered much of the upper-right PDF content and displayed a stale prior gesture label. These usability issues have now been addressed.

The November 9 experimental `HeadPoseGestureEngine` (nose relative to eye midpoint + a more complex neutral/reset state) was **removed**. The older, previously functioning nose-position tracker was restored. It now uses actual MediaPipe eye distance to scale only the head thresholds, allowing smaller physical movement with a distant face while keeping the existing rearm and cooldown. The original head-direction mapping is preserved; only the required displacement scales with face size.

Head stays the default, Hands and Eyes remain optional. PDF-only scrolling is retained. The HUD is compact by default with a Details control; it hides stale gesture messages and explicitly marks SmartSpectra measurements as unavailable if the SDK errors.

This is a correction to an observed regression, **not proof of successful physical-camera calibration**. Run `npm run build`, `npm test` and a real Windows camera session before claiming final success. SmartSpectra native-only success on Windows does not establish that its Electron renderer pipeline is free of error 8, and the unidentified leaked VideoFrame must not be claimed fixed.

## Gesture verification

1. Use Head (default), open a 5-page PDF and enable camera once. Watch that real head model reports ready.
2. Gently move head right/left from your relaxed starting pose; page counter should advance/rewind once per gesture, without multi-page jumps.
3. On a zoomed or tall PDF page, nod down and up; the content should scroll within that page but the page counter must stay unchanged.
4. Return to your relaxed pose between gestures. A held pose must not repeat indefinitely. Sit at different distances from the webcam; the required movement should remain modest.
5. Choose Hands in Settings to verify open-palm swipes separately. Choose Eyes only if testing actual SmartSpectra blink navigation.
6. Leave camera on for several minutes. Pause/resume, reconnect and verify no false commands or frozen state.
7. Record *only red actionable errors* and the frame-rate settings; the XNNPACK INFO log is expected.

## Known limits

- Gesture thresholds are initial engineering values, not hardware-calibrated measurements.
- The first model download requires internet; current model assets are not bundled for offline use.
- No real Windows camera test has been completed by the assistant.
- SmartSpectra failure no longer intentionally releases the host-owned camera stream. When SDK processing fails (including code 8 or depleted credits), local head/hand gestures should stay on while SmartSpectra blink processing stops. This fallback is not proof of successful SmartSpectra measurement. Verify with a real Windows camera.
- The SmartSpectra vendor still requires sustained ~25 FPS (ideally 30) for measurements. If its warning persists, test with strong front lighting, close competing camera applications, and use a webcam that genuinely delivers 30 FPS. VideoFrame disposal warnings may originate inside the vendor renderer frame pump and cannot be safely fixed from Glimra's MediaPipe component.
- Hand detection currently estimates an open palm from extended finger landmarks; it needs real-user verification across different lighting and camera angles.

## SmartSpectra error 8: one definitive isolation check

If Electron keeps reporting `SmartSpectra error (8): processing failed`, **stop Glimra completely** and close Zoom, Teams, Camera, OBS and any other program that might own the webcam. This diagnostic uses the real Presage SDK on the same Windows machine, but excludes Electron's renderer and MediaPipe.

In PowerShell:

```powershell
git pull origin main
$env:PRESAGE_API_KEY = Read-Host 'Enter your SmartSpectra API key'
node .\scripts\check-smartspectra-native.cjs
$env:PRESAGE_API_KEY = $null
```

The test attempts one live 20-second session, with no retries, and may consume actual SmartSpectra credits. No camera frames or biometric values are saved. Share **only the JSON summary following [SDK-only] RESULT**; do not send your API key.

Interpretation:

- **Native test reaches Running, emits metrics and kOk validation:** The camera and SDK can function together outside Electron. Investigate renderer frame processing/IPC/main-thread contention, including MediaPipe's synchronous inference. Do not blame the hardware automatically.
- **Native test also shows error code 8 or low-FPS validation (11):** The problem reproduces without Glimra or MediaPipe. Verify that the Windows camera delivers at least 25 real FPS in good front light and no other camera app is running; compare with Presage's official quickstart. Escalate to support@presagetech.com with SDK version, Windows/webcam model, and the **redacted** result if still failing.
- **No camera discovered:** Check Windows privacy permissions or device drivers. This is not a MediaPipe model-loading error.

The XNNPACK “Created TensorFlow Lite XNNPACK delegate for CPU” line is an INFO message from MediaPipe initialization, not evidence of SmartSpectra failure.

## Earlier worker regression

A prior MediaPipe module Worker failed in Electron with `ModuleFactory not set`; it was removed. Head/Hands currently use the supported in-renderer MediaPipe path, loading only one model at a time. The native-only SmartSpectra test succeeded, but its Electron bridge still requires separate debugging for error 8.


## November 9 afternoon: SmartSpectra error 8 during successful head presentation

A real Windows 83-second screen recording showed successful head-driven PDF slide navigation and scrolling from the beginning of the demonstration, followed by `SmartSpectra error (8, retryable=true): SmartSpectra processing failed`. The same console showed **multiple validation code 11** warnings ("Use a camera mode that provides at least 25 frames per second") and **4.3 SmartSpectra metrics callbacks/sec** (not the same thing as captured camera FPS). SmartSpectra moved from `kRunning` to `kError`.

The earlier **independent native SDK** run on the same Windows machine and webcam had `495` metrics callbacks, `508` valid validations, `0` low-FPS warnings, `0` errors. This is evidence of an **Electron integration / concurrent frame-processing problem**, not proof of faulty webcam hardware or Presage account credentials. It does not prove which part of the renderer pipeline is starving frames.

There is a second lifecycle problem: Glimra previously handed the **original** browser MediaStreamTrack to `sdk.useMediaStream()` and called `sdk.stop()` after error 8. Although Presage documents host-owned streams as host-managed, this put the independently working gesture track in the SDK processing path and made stream shutdown behavior harder to isolate. The controller now creates `new MediaStream([track.clone()])` **only for SmartSpectra**. The original remains connected to MediaPipe. Shutdown releases the clone, not the original, unless the user explicitly disconnects the camera. This improves fault isolation but is not a verified fix for SDK error 8 or low FPS.

The local gesture tracker now watches live `video.currentTime`; if video frames stop advancing for 3.5 seconds, it logs `[Glimra/Gestures] Camera frames stalled` with original track state, muted state, video readyState and video time. The HUD should no longer claim gesture readiness during a confirmed frame stall, and will restore readiness if frames resume. **Never assume MediaPipe models are processing new frames merely because their models initialized.**

In the last video, the PDF counter reached the final page (`5 / 5`). Rightward gestures correctly cannot advance beyond the last page; likewise down gestures cannot scroll past the bottom. For a conclusive post-error gesture test, first move to page `2 / 5` manually and keep a scrollable page centered.

### One hardware verification after the change

```powershell
git pull origin main
npm run build
npm test
npm run dev
```

Use the existing comfortable Head control, with the camera enabled, and show a tall page with room to scroll in **both directions**. Test until a SmartSpectra error 8 occurs or at least 30 seconds pass. If SDK fails, inspect:

- `[Glimra/Camera] after SDK-only shutdown`: the original track should remain live, but live status alone does not prove new video frames arrive.
- `[Glimra/Gestures] Camera frames stalled` (if present): establishes frame delivery stopped.
- `[Glimra/Gestures] Camera frames resumed` (if present): confirms later delivery recovered.
- `[Glimra/SmartSpectra] validationStatus` code 11: means the native processing pipeline is seeing insufficient frame rate.

Do **not** restart the native SDK automatically after every code 8; it can incur real credit charges and will not cure persistent sub-25-FPS frame delivery. The specific native error is `kProcessingFailed`, not the same as an authentication failure, credits exhaustion, or a fatal MediaPipe initialization error. If the clone isolates gestures but SDK still fails, next engineering work should compare a **no-MediaPipe Electron SDK-only capture** and Presage's official `electron-quickstart` to pinpoint renderer/IPC pressure.
