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

## Head movement mechanics

The previous head tracker watched the nose move ~8.5% of the **whole camera frame**: too much movement if the user sits farther away.

The current `HeadPoseGestureEngine` instead reads face landmarks for nose and both eye corners, estimating **turn**, **side tilt**, and **vertical nod relative to the face width**, and adapts to the user's initial pose. It applies filtering, two consecutive directional observations, a single command per turn, a 650ms cooldown, and neutral reset. It requires **no fixed position or physical calibration ritual**. It has unit tests for small movements, off-center starting posture, idle tracking and rejecting single-sample jitter. Real Windows testing is still essential to verify vertical direction, user comfort and false-positive behavior.

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

## November 9 worker regression and recovery

The user's video showed that moving MediaPipe inference into an Electron module Worker introduced **`ModuleFactory not set`**. This is a real failure: the local gesture tracker could not start, so no head/hand gesture worked. That worker implementation was removed, and the previously functional in-renderer MediaPipe route was restored.

To reduce processing load without the broken worker, Glimra loads **only one detector at a time**: Head (default, approximately 7 frames/second) or Hands (optional, approximately 5 frames/second). Eyes is a separate opt-in SmartSpectra blink mode. SmartSpectra still receives genuine human data and remains subject to its live processing constraints.

PDF scroll now targets the scrollable viewer inside the **current page only**, using a block overflow layout. Arrow Up/Down also send the same page scroll command as a gesture; use those keys to verify PDF scrolling independently before evaluating landmark accuracy.

The standalone native SmartSpectra run on Windows confirmed 495 metrics callbacks, 508 valid signal validations, 0 frame-rate warnings and 0 errors. This does not prove SmartSpectra can sustain valid processing concurrently with MediaPipe in Electron.

**Unverified:** the new hand-first UI, return-to-neutral gesture calibration, and live scroll behavior still need real Windows app tests. Do not claim these work end to end based only on code changes. The app no longer references the failed Worker.

Rotate any exposed Presage API key before further live testing.
