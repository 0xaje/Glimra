# Glimra

> **Control without a touch.**

Glimra is a hands-free desktop presentation application. It allows presenters to navigate slides through intentional, calibrated eye gestures detected using the **Presage SmartSpectra SDK**.

Built for teachers, keynote speakers, trainers, workshop hosts, and anyone who benefits from touchless presentation control.

---

## Current Status & Verification Transparency

In strict adherence to engineering integrity rules, we clearly distinguish between verified features and items pending hardware or credentials:

- **Verified Capabilities:**
  - **PDF Presentation Engine:** Fully offline PDF slide viewer powered by PDF.js, with canvas scaling, slide navigation state machine, keyboard controls, and fullscreen mode (`tests/presentation.test.mjs` passing 3/3).
  - **Gesture Engine Logic:** Intentional dwell recognition ($\ge 350\text{ ms}$), 1.2s refractory cooldown, involuntary blink rejection (<250ms), double-blink rewind, stability flag filtering, and non-monotonic timestamp protection (`tests/gestureEngine.test.mjs` passing 8/8).
  - **Hallmark Design Craft:** Strict Darkroom Amber presenter design passing `sloplint.mjs` with 0 failures, 0 reflex flags, and 0 warnings.
  - **Security Architecture:** Presage API keys are encrypted locally using Electron's `safeStorage` (OS Keychain / DPAPI / libsecret) via IPC; camera permissions are strictly origin-checked and blocked without explicit presenter consent.
  - **Native SDK Integration:** Native `libsmartspectra_capi.so` loads via `koffi` FFI; communicates with Presage REST endpoints; decodes `face.blinking` and `face.landmarks` Protobuf buffers accurately (`tests/sdk-diagnostic.mjs` passing 4/4).
  - **Automated CI/CD & Linux Packaging:** GitHub Actions builds the production bundle, runs tests, and packages `Glimra-1.0.0.AppImage` (289 MB) as a downloadable workflow artifact (`glimra-linux-x64`).

- **Pending Verification & Blockers:**
  - **Physical Camera Hardware:** The development environment (WSL2) does not expose `/dev/video*`. Live camera frame acquisition and end-to-end human gesture testing on a physical webcam require a physical machine or USB camera pass-through (see [docs/CAMERA_TESTING_PROCEDURE.md](docs/CAMERA_TESTING_PROCEDURE.md)).
  - **Production Presage API Key:** A genuine API key from Presage is required to establish an authenticated live session.
  - **Clean-Computer Desktop Startup:** Running and launching the packaged AppImage on an independent desktop without dev dependencies is pending (see [docs/PACKAGING_AND_INSTALLATION.md](docs/PACKAGING_AND_INSTALLATION.md)).

---

## Architecture & Technology Stack

- **Desktop Framework:** Electron
- **User Interface:** React + TypeScript
- **Build Tooling:** Vite
- **Physiology & Facial Engine:** `@smartspectra/node-sdk` (Presage Technologies)
- **Slide Rendering:** PDF.js (`pdfjs-dist`)
- **Design System:** Hallmark (Darkroom Amber theme)

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full architectural documentation.

---

## Getting Started

### Prerequisites
- Node.js >= 20 (Node 22 or 24 recommended)
- A webcam (built-in or USB)
- A Presage SmartSpectra API key from [physiology.presagetech.com](https://physiology.presagetech.com)

### Installation

```bash
# Clone the repository
git clone https://github.com/0xaje/Glimra.git
cd Glimra

# Install dependencies
npm install

# Run development mode
npm run dev
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
