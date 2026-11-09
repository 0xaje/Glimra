# Glimra

> **Control without a touch.**

Glimra is a hands-free PDF presentation application powered by the **official Presage SmartSpectra SDK**. Its default Head mode interprets actual live Presage facial landmarks to move between slides and scroll within the current PDF page. Optional Eyes mode uses real SmartSpectra blinking detections. **No MediaPipe or other automatic gesture-tracking SDK is used.**
Built for teachers, keynote speakers, trainers, workshop hosts, and anyone who benefits from touchless presentation control.

---

## Current verification status

**Confirmed with a genuine Windows webcam and Presage's native Node SDK (November 9, 2026):**

- 487 real SDK metrics packets, all decoded
- 416 stable Presage facial-landmark samples
- 478 facial points per sample
- 566 valid SDK quality checks, **0** low-frame-rate warnings, **0** SDK errors
- Real face-centroid movement ranges: horizontal **0.539** and vertical **0.266** face widths

This established that Presage can supply the signals required for Glimra's head navigation. **The diagnostic detected zero blinking starts**; the optional Eyes interaction is not yet independently verified.

**Implemented on `main` (Windows desktop verification still required):**

- Native camera worker in a dedicated Node child process, using `SmartSpectraSDK.useCamera(CameraSelection.default)` to avoid the old Electron renderer-frame-transfer bottleneck.
- Head movements derived from **real, stable** `metrics.face.landmarks[]` samples, with smoothing, a deliberate two-frame movement, and rearming after return to a relaxed position.
- Eyes mode from genuine `metrics.face.blinking[]` samples only. No fake blink feedback.
- Gesture commands and quality status passed to the renderer via a restricted Electron IPC bridge. No raw camera images or face coordinates are sent.
- MediaPipe and old browser camera gesture processing removed. User permission and API key are required for native capture. Keyboard navigation remains available without the camera.

**Current status:** Linux build, design audit, unit tests and unsigned Windows installer packaging run in GitHub Actions. The presenter reports that actual native Presage head movements control the PDF and have improved substantially. Still **not verified**: a five-minute stability test, clean Windows installer camera operation, second-presenter handover under varied lighting, and real Eyes-mode blink control. Do not claim those milestones passed.

Read the [current full codebase audit and independent 76/100 judge review](docs/CODEBASE_AUDIT_REPORT.md), the [strict Presage-first implementation plan](docs/PRESAGE_ONLY_IMPLEMENTATION.md), and the [real-camera acceptance checklist](docs/CAMERA_TESTING_PROCEDURE.md).

---

## Architecture & Technology Stack

- **Desktop Framework:** Electron
- **User Interface:** React + TypeScript
- **Build Tooling:** Vite
- **Live SmartSpectra Signals:** `@smartspectra/node-sdk` (Presage Technologies)
- **Genuine Head/Eye Sensing:** Native SmartSpectra facial landmarks and blinking detection; no external sensing engine
- **Native Camera Service:** Dedicated Node child process + Electron IPC
- **Slide Rendering:** PDF.js (`pdfjs-dist`)
- **Design System:** Hallmark (Darkroom Amber theme)

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full architectural documentation.

---

## Getting Started

### Prerequisites
- Node.js >= 22.12.0
- A webcam (built-in or USB)
- A valid Presage SmartSpectra API key from [physiology.presagetech.com](https://physiology.presagetech.com), required for **Head and Eyes**

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
Both Head and Eyes use the real native Presage SDK. Enter your SmartSpectra API key in **Settings**. No automatic gesture control is offered when Presage is unavailable. The key is encrypted locally using Electron's OS-backed `safeStorage` when available; key persistence is refused otherwise and is never exposed in browser localStorage, committed to version control, or bundled into application distributions.

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
