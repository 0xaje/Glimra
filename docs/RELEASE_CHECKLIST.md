# Glimra Release & Deployment Verification

This document guides the testing, security audit, and packaging process for Glimra.

---

## 1. Security & Credential Safeguards

- [x] Zero hardcoded API keys or developer credentials in client source code.
- [x] `.env` is strictly gitignored (`.env.example` provided with placeholder).
- [x] Presage API keys are supplied by the end user via the Settings modal and persisted in local client storage.
- [x] No cloud video streaming: all camera frames remain in local device memory.
- [x] Camera hardware releases immediately when stopped or paused.

---

## 2. Hallmark Design System Compliance

Every frontend component in Glimra is audited with the mechanical Hallmark linter:

```bash
node .agents/skills/hallmark/scripts/sloplint.mjs \
  src/renderer/src/styles/globals.css \
  src/renderer/src/App.tsx \
  src/renderer/src/components/SlideViewer.tsx \
  src/renderer/src/components/PresenterHUD.tsx
```

**Verification Result:**
`sloplint: clean. 0 FAIL, 0 REFLEX, 0 WARN across 4 file(s).`

### Hallmark Design Floor Verification Checklist:
- [x] All colors, typography, and spacing routed through `:root` CSS variables.
- [x] Zero machine-tell gradients (no purple-to-blue gradients).
- [x] Zero cards inside cards or fake activity tickers.
- [x] Strict `:focus-visible` outline rings on all interactive elements.
- [x] `overflow-x: clip` enforced on `html` and `body`.
- [x] True typography hierarchy and full `@media (prefers-reduced-motion: reduce)` compliance.

---

## 3. Automated Test Verification

All 16 automated test cases across foundation, gesture engine, and presentation engine pass with zero failures:

```bash
$ npm test
✔ Glimra Foundation — Core Documentation Suite (3.26ms)
✔ Glimra Foundation — Security Audit (No Committed Credentials) (0.93ms)
✔ Glimra Foundation — SmartSpectra SDK Native Export Surface (75.31ms)
✔ Glimra Foundation — Build Artifacts Generated (0.38ms)
✔ M3 Gesture Engine: Involuntary Blinks (<350ms) are Ignored (1.43ms)
✔ M3 Gesture Engine: Unstable Biometric Samples Are Discarded (0.27ms)
✔ M3 Gesture Engine: Non-monotonic & Stalled Timestamps Handled Safely (0.28ms)
✔ M3 Gesture Engine: Intentional Prolonged Blink (400ms) Advances Slide (0.56ms)
✔ M3 Gesture Engine: Refractory Cooldown Suppresses Double Advances (0.31ms)
✔ M3 Gesture Engine: Verified Double Blink Triggers Previous Slide (0.39ms)
✔ M3 Gesture Engine: Double Blink Rejects Inappropriate Gaps and Durations (0.20ms)
✔ M3 Gesture Engine: Pause and Face Loss Disarm Processing Immediately (0.51ms)
✔ M3 Gesture Engine: Dynamic Sensitivity Tuning via updateConfig (0.52ms)
✔ M2 Presentation Engine: Real PDF Document Import & Page Count (86.69ms)
✔ M2 Presentation Engine: Slide Navigation State Machine (0.46ms)
✔ M2 Presentation Engine: Corrupted Buffer Error Handling (2.17ms)
ℹ tests 16, suites 0, pass 16, fail 0
```

---

## 4. Production Build & Packaging Instructions

### Development & Live Run
```bash
npm install
npm run dev
```

### Production Bundling
```bash
npm run build
```
Generates:
- `dist/index.html` — Optimized renderer entry.
- `dist/assets/pdf.worker.min-*.mjs` — PDF.js background worker.
- `dist/assets/index-*.js` — Minified React application bundle.
- `dist-electron/main.js` — Main Electron process bundle.
- `dist-electron/preload.js` — Preload bridge bundle.

### Packaging Executables (Linux, Windows, macOS)
```bash
# Package for Linux (AppImage)
npm run dist:linux

# Package for Windows (NSIS Installer)
npm run dist:win

# Package for macOS (DMG)
npm run dist:mac
```

*Note on Network Throttling in WSL2:* Packaging for target platforms via `electron-builder` requires fetching the prebuilt Electron binary archive (~100MB) from GitHub releases. In environments with heavily throttled GitHub asset connections, set `ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"` to accelerate download speeds.
