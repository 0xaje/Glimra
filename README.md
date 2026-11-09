# Glimra

> **Control without a touch.**

Glimra is a hands-free desktop PDF presentation application. **Gentle head movement is the default control**: small right/left turns change slides and up/down nods scroll inside the current PDF page. Glimra uses face-relative landmarks and learns your relaxed starting pose instead of requiring large screen-wide head movement. Open-hand swipes and SmartSpectra-powered blink controls remain optional. The Presage SmartSpectra SDK is integrated for genuine live human-signal processing.

Built for teachers, keynote speakers, trainers, workshop hosts, and anyone who benefits from touchless presentation control.

---

## Current status and honest verification

- **Confirmed on real Windows hardware:** the native SmartSpectra SDK, running without Electron/MediaPipe, delivered 495 metrics callbacks, 508 valid signal validations, zero low-frame-rate warnings and no errors in a live session.
- **Previously observed in Glimra:** head left/right slide navigation worked before the experimental gesture Web Worker change. The attempted Worker generated `ModuleFactory not set` in the user’s video and was removed.
- **Current controls:** Head (default) for subtle turns, tilts and nods, including PDF-only vertical scrolling; Hands (optional) for open-hand swipes; Eyes (optional) for SmartSpectra long/double blink navigation. Keyboard controls remain available.
- **Still requires verification on the user's Windows machine:** the new adaptive head-pose sensitivity, vertical direction and rearming behavior, and stable concurrent SmartSpectra processing. The latest user recording showed functioning slide navigation, but gestures needed too much head movement. An SDK error 8 in Electron is not resolved merely by a successful native-only session.
- **No simulated biometric readings or camera activity.** Models download on first use, run locally, and use the camera only after permission. SmartSpectra may perform SDK telemetry according to Presage policy.

See [Live Gesture Verification](docs/LIVE_GESTURE_VERIFICATION.md) for a focused Windows test plan.

---

## Architecture & Technology Stack

- **Desktop Framework:** Electron
- **User Interface:** React + TypeScript
- **Build Tooling:** Vite
- **Live SmartSpectra Signals:** `@smartspectra/node-sdk` (Presage Technologies)
- **Default Hand/Optional Head Gestures:** `@mediapipe/tasks-vision`
- **Slide Rendering:** PDF.js (`pdfjs-dist`)
- **Design System:** Hallmark (Darkroom Amber theme)

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full architectural documentation.

---

## Getting Started

### Prerequisites
- Node.js >= 22.12.0
- A webcam (built-in or USB)
- A Presage SmartSpectra API key from [physiology.presagetech.com](https://physiology.presagetech.com)

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
Open **Settings** in Glimra and enter your Presage API key. The key is encrypted locally using Electron's `safeStorage` and is never exposed in browser localStorage, committed to version control, or bundled into application distributions.

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
