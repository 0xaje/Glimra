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

## Real camera checks

1. Open a PDF with at least three slides. Connect the camera with consent and your valid SmartSpectra API key.
2. Face the camera and move your head to your right. Confirm exactly one next-slide command. Return to center, then move to your left to go back. Repeat with a deliberate open-hand swipe.
3. On a tall or zoomed PDF page, move your head or open hand up/down. Confirm that **only the current page** scrolls and the slide number stays unchanged.
4. Hold the same position after a command. Verify it does not repeatedly advance. Return to neutral before the next command.
5. Leave the presentation untouched for 5 minutes and then an hour; verify the camera remains connected and the next gesture still works.
6. Pause gesture control; verify neither face nor hand motion navigates. Resume and retry.
7. Cover your face/hand briefly, then uncover it; verify tracking resumes without a false command.
8. Confirm the live SmartSpectra signal still works, and review its independent validation/processing status. SDK error code 8 and frame-rate warning 11 require real Windows hardware diagnostics.

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

## Renderer bottleneck correction (Nov 9, 2026)

A **real native-only Windows camera test** on the same machine returned 495 metrics callbacks, 508 valid SmartSpectra signals, zero low-FPS warnings, and no SDK errors. This establishes the webcam and the standalone SmartSpectra SDK can succeed. The problem is specific to the integrated Electron path or concurrent work, not a universal camera failure.

The renderer SDK uses a frame-processing pipeline. MediaPipe's synchronous `detectForVideo()` previously ran on that same renderer main thread and could delay SDK frame delivery. This is now changed:

- `src/renderer/src/components/LiveGestureTracker.tsx`: asynchronously captures a small `ImageBitmap` no more than about 6 times a second, transfers it to a dedicated Web Worker, and drops frames while that worker is busy.
- `src/renderer/src/workers/gestureWorker.ts`: performs face and hand model inference away from the renderer, returns **real** observed commands, and closes every received `ImageBitmap` in `finally`.
- The browser camera and SDK still share one actual MediaStream. SmartSpectra processing retains priority on the renderer thread.
- If SDK still reports error 8, this change has not solved the complete Electron path; examine SDK renderer frame pump/IPC against the official Electron quickstart. Do **not** report a successful SmartSpectra session until real `kRunning`, valid `kOk` and metrics have been observed together.

Test on Windows after updating main:

```powershell
git pull origin main
npm run build
npm test
npm run dev
```

Look for `[Glimra/Gestures] Worker models ready (off renderer thread)` and SmartSpectra `processingStatus 3 kRunning`, then let the camera run in front light for 20+ seconds. A valid SDK session must produce metrics and validation kOk; simply having no visible error is insufficient.

Rotate any API key accidentally pasted into chats or shared logs before continuing.
