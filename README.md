# Glimra

> **Control without a touch.**

Glimra is a hands-free desktop PDF presentation application. **Gentle head movement is the default control**: small right/left turns change slides and up/down nods scroll inside the current PDF page. Glimra uses the earlier working head-position tracking method, with a movement threshold adjusted to your face size, instead of requiring large camera-wide head movement. Open-hand swipes and SmartSpectra-powered blink controls remain optional. The Presage SmartSpectra SDK is integrated for genuine live human-signal processing.

Built for teachers, keynote speakers, trainers, workshop hosts, and anyone who benefits from touchless presentation control.

---

## Presage-only challenge direction (November 9, 2026)

**Strict decision:** SmartSpectra is the only allowed source of automatic human-sensing commands in the final challenge build. The current MediaPipe-based default Head/Hands pipeline is **not yet compliant with that product decision**. We are replacing it with genuine SmartSpectra native facial landmarks and blinking, not portraying the existing local gesture controls as Presage signals.

A non-invasive real-hardware diagnostic was added at `scripts/check-presage-live-facial-signals.cjs`; the [Presage-only implementation contract](docs/PRESAGE_ONLY_IMPLEMENTATION.md) records supported metrics, the target architecture, the migration order, and objective pass/fail criteria. **The native SDK landmark test and main-app migration are not yet verified.** The current app is not presented as Presage-only until that is complete.

```powershell
# Run only after closing Glimra and other webcam apps.
# This real SDK diagnostic may consume measurement credits.
$env:PRESAGE_API_KEY = Read-Host 'Your new SmartSpectra API key'
node .\\scripts\\check-presage-live-facial-signals.cjs
Remove-Item Env:\\PRESAGE_API_KEY
```

**Never paste an API key into issues, logs, demos or chats.** If a key was exposed, rotate it.

---

## Current status and honest verification

- **Confirmed on real Windows hardware:** the native SmartSpectra SDK, running without Electron/MediaPipe, delivered 495 metrics callbacks, 508 valid signal validations, zero low-frame-rate warnings and no errors in a live session.
- **Previously observed in Glimra:** head left/right slide navigation worked before the experimental gesture Web Worker change. The attempted Worker generated `ModuleFactory not set` in the user’s video and was removed.
- **Current controls:** Head (default) for subtle turns, tilts and nods, including PDF-only vertical scrolling; Hands (optional) for open-hand swipes; Eyes (optional) for SmartSpectra long/double blink navigation. Keyboard controls remain available.
- **New stability isolation (awaiting Windows confirmation):** Head and Hands run with the browser camera and MediaPipe only, without SmartSpectra initialization, API key, or credit usage. Eyes exclusively runs the genuine SmartSpectra SDK for intentional blink navigation. Switching between Eyes and other modes intentionally restarts the camera. The previous concurrent Electron pipeline repeatedly produced low-FPS validation and error 8. The last full recording showed Head navigation continued even after that error, so gesture responsiveness and SDK measurements must be verified separately.
- **Hackathon verification still required:** demonstrate a successful live SmartSpectra-driven command in Eyes mode. Head/Hands alone are MediaPipe features and cannot be presented as proof of SmartSpectra SDK use.
- **No simulated biometric readings or camera activity.** Models download on first use, run locally, and use the camera only after permission. SmartSpectra may perform SDK telemetry according to Presage policy.

See [Live Gesture Verification](docs/LIVE_GESTURE_VERIFICATION.md) for a focused Windows test plan.

---

## Architecture & Technology Stack

- **Desktop Framework:** Electron
- **User Interface:** React + TypeScript
- **Build Tooling:** Vite
- **Live SmartSpectra Signals:** `@smartspectra/node-sdk` (Presage Technologies)
- **Default Head/Optional Hand Gestures:** `@mediapipe/tasks-vision`
- **Slide Rendering:** PDF.js (`pdfjs-dist`)
- **Design System:** Hallmark (Darkroom Amber theme)

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full architectural documentation.

---

## Getting Started

### Prerequisites
- Node.js >= 22.12.0
- A webcam (built-in or USB)
- A Presage SmartSpectra API key from [physiology.presagetech.com](https://physiology.presagetech.com) **only for Eyes mode**

### Installation & Development

```bash
# Clone the repository
git clone https://github.com/0xaje/Glimra.git
cd Glimra

# Install dependencies
npm install

# Run development mode
npm run dev
```

### Packaging & Distribution

```bash
# Package for Linux (AppImage)
npm run dist:linux

# Package for Windows (NSIS installer)
npm run dist:win

# Package for macOS (DMG/zip)
npm run dist:mac
```

### Entering your API Key
Head and Hands work without a Presage API key. For optional **Eyes** mode, open **Settings** in Glimra and enter your Presage API key. The key is encrypted locally using Electron's `safeStorage` and is never exposed in browser localStorage, committed to version control, or bundled into application distributions.

---

## Roadmap & Milestones

See [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md) for the implementation roadmap and [docs/PROGRESS.md](docs/PROGRESS.md) for live progress tracking.

---

## Challenge Entry

- **Challenge:** [Presage SmartSpectra SDK Challenge 2026](https://dev.to/challenges/presage-2026-11-04)
- **Deadline:** November 22, 2026, 11:59 PM PST

---

## License

MIT License. See [LICENSE](LICENSE) for details.
