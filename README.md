# Glimra

> **Control without a touch.**

Glimra is a hands-free desktop presentation application. It allows presenters to navigate slides through intentional, calibrated eye gestures detected using the **Presage SmartSpectra SDK**.

Built for teachers, keynote speakers, trainers, workshop hosts, and anyone who benefits from touchless presentation control.

---

## Key Highlights

- **Intentional Eye Gesture Control:** Advances slides via deliberate dwell gestures detected by Presage SmartSpectra's optical facial models, distinguishing intentional signals from spontaneous physiological blinks.
- **Privacy First:** Video frames are processed locally on your machine. No video or audio is ever recorded, saved, or uploaded. Camera activation requires explicit presenter consent.
- **Full Presentation Viewer:** Works out of the box as a clean, distraction-free PDF presentation viewer with instant keyboard and mouse controls.
- **Hallmark Design:** Crafted under the **Hallmark** design discipline (Darkroom theme). Zero AI slop, no distracting glowing borders, no unnecessary cards, and complete adherence to accessibility standards.
- **Immediate Pause & Fallback:** Instant keyboard pause (`Space` or `P`) and physical key navigation (`ArrowRight`, `ArrowLeft`, `F` for fullscreen) always available.

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

# Configure environment
cp .env.example .env
# Enter your PRE_PAGE_SMARTSPECTRA_API_KEY in .env

# Run development mode
npm run dev
```

### Build & Package

```bash
# Compile and build desktop binary
npm run build
npm run dist:linux   # Linux AppImage
npm run dist:win     # Windows NSIS installer
npm run dist:mac     # macOS DMG / zip
```

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
