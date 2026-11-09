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

## Real hand-first presentation checks

1. Open a multi-page PDF, connect the camera with consent, and keep **Hands (default)** selected in Settings.
2. Wait for `[Glimra/Gestures] Real hand tracking ready`. Show one open hand in view and swipe to your **right** to advance one slide. Return the hand to the center, swipe **left** to go back.
3. On a **tall page** or a page enlarged using **Fit width** or Zoom in, swipe **down** to move down **inside that PDF page**, then swipe **up** to go back. The page number MUST stay unchanged.
4. Verify scrolling without the camera first: Arrow Down/Up should scroll within the same PDF page. If there is no overflow, the whole page is already visible and no scroll is possible until zoomed.
5. Choose **Head** in Settings. Moving your head left/right should change slides; nodding up/down should scroll within the current PDF page.
6. Choose **Eyes** in Settings only if you want the original SmartSpectra long-blink/double-blink controls. Blink navigation must NOT trigger in Hands/Head modes; SmartSpectra still processes real live signal measurements.
7. Pause for 5 minutes or longer. The camera should stay connected. Returning the hand to neutral must allow a new command. Disconnect explicitly to turn off the camera.
8. Check SDK status separately; a real native-only SDK session succeeded on Windows, but Electron integration has previously emitted error 8.

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

## November 9 regression and hand-first correction

The user's video showed that moving MediaPipe inference into an Electron module Worker introduced **`ModuleFactory not set`**. This is a real failure: the local gesture tracker could not start, so no head/hand gesture worked. That worker implementation was removed, and the previously functional in-renderer MediaPipe route was restored.

To reduce processing load without the broken worker, Glimra now loads **only one detector at a time**: Hands (default) or Head (optional), at about 5 landmark checks per second. Eyes is a separate opt-in SmartSpectra blink mode. SmartSpectra still receives genuine human data and remains subject to its live processing constraints.

PDF scroll now targets the scrollable viewer inside the **current page only**, using a block overflow layout. Arrow Up/Down also send the same page scroll command as a gesture; use those keys to verify PDF scrolling independently before evaluating landmark accuracy.

The standalone native SmartSpectra run on Windows confirmed 495 metrics callbacks, 508 valid signal validations, 0 frame-rate warnings and 0 errors. This does not prove SmartSpectra can sustain valid processing concurrently with MediaPipe in Electron.

**Unverified:** the new hand-first UI, return-to-neutral gesture calibration, and live scroll behavior still need real Windows app tests. Do not claim these work end to end based only on code changes. The app no longer references the failed Worker.

Rotate any exposed Presage API key before further live testing.
