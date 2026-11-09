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
