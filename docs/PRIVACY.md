# Glimra — camera consent and data handling

Updated November 9, 2026. Applies to the **current native Presage implementation**, not the discontinued Electron renderer capture.

## Consent and controls

- The user must deliberately choose **Enable camera control** and grant consent before Glimra starts the official Presage SmartSpectra native camera session. A presentation remains usable with keyboard and mouse when the camera is disconnected.
- **Pause** stops gesture commands but does **not** disconnect or switch off camera acquisition. **Disconnect camera** and closing the app request native SDK teardown and camera release. Do not describe Pause as turning off the physical webcam.
- Only one person should be in view for gesture recognition; the app reports missing/multiple faces and supports recentering when another presenter takes over.
- The user can turn off the camera or delete the locally stored key via Settings (clear the key and save).

## What Glimra collects and retains

- **Camera:** raw frames are processed locally by the native SmartSpectra SDK. Glimra does not record, upload, save, or share camera footage or face landmarks. Its React renderer does not receive raw frames or landmark arrays.
- **Derived signals:** the renderer receives a direction (left/right/up/down), source type (head/blink), face-tracking status, quality hints and aggregate sample counts. Signals are held in process memory, not stored in a user history database.
- **Documents:** PDF files are loaded and rendered locally through PDF.js. Glimra does not upload or retain the PDF content.
- **Authentication:** Presage API keys are stored encrypted with Electron OS `safeStorage` when supported. On systems without a real OS-backed keychain, Glimra refuses to save a key unencrypted. Keys are not written to browser `localStorage`, logged, or bundled in the repository.
- **Preferences:** non-sensitive UI settings such as theme, selected control method and eye timing may be stored in browser `localStorage`. They can be cleared by deleting app data.
- **Audio:** generated slide chimes use Web Audio synthesis. No microphone or audio recording is requested.
- **AI services:** Glimra does not integrate an optional cloud AI service.

## Third-party service and telemetry

Glimra uses `@smartspectra/node-sdk` for real local facial analysis and selects `enableTelemetry: false`. Presage account authentication, metering and entitlements may require network access. The presence of a local SDK pipeline does **not** mean the application is completely offline. Do not claim to control how Presage independently handles its own backend data; refer to [Presage's privacy and telemetry documentation](https://presagetech.com/docs/smartspectra-sdk/nodejs).

## Security limitations and retention

When the app closes or capture is disconnected, the native capture session is stopped and in-memory measurements are released with the process. The encrypted API key remains in OS-supported storage until cleared or app data is deleted. Electron BrowserWindow sandbox hardening and packaged clean-machine verification remain audit items; these are not certified security guarantees.

These disclosures describe the inspected implementation. If capture, telemetry, storage or network behavior changes, update this file and the submission consent statement before publishing.
