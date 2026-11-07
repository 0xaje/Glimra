# Glimra — Comprehensive Codebase Audit, Cleanup & Maintenance Report

**Date:** November 7, 2026  
**Repository:** `https://github.com/0xaje/Glimra`  
**Application ID:** `com.glimra.presentation`  
**Branch:** `design/glimra-studio-dark-light`  
**Auditor:** Senior Software Engineer & Application Architect  

---

## Executive Summary & Audit Metrics

A rigorous two-pass audit was conducted across the entire repository to uncover and eliminate genuinely unused code, obsolete frontend implementations, orphaned assets, dead exports/methods, duplicate styles, and unnecessary dependencies.

| Category | Inspected Count | Confirmed Unused Removed | Retained & Active Count | Uncertain Items |
| :--- | :---: | :---: | :---: | :---: |
| **React Components & Layouts** | 5 | 0 | 5 | 0 |
| **Static Assets (Images / PDFs / Audio / Fonts)** | 2 | 0 | 2 | 0 |
| **Direct Runtime Dependencies** | 5 | 0 | 5 | 0 |
| **Development Dependencies** | 10 | 0 | 10 | 0 |
| **CSS Class Selectors** | 58 | 2 | 56 | 0 |
| **Dead Functions / Class Methods** | 1 | 1 | 0 | 0 |
| **Temporary / Bloat Working Tree Files** | 10 | 10 | 0 | 0 |

---

## 1. Component & Frontend Architecture Audit

### Inventory & Usage Tracing
Every frontend component and module in `src/renderer/src/` was inventoried and traced through the dependency graph:

| Component / File | Exported Symbol(s) | Imported By | Render / Runtime Status | Retained Reason |
| :--- | :--- | :--- | :--- | :--- |
| `src/renderer/src/main.tsx` | Entry file | `index.html` | Mounted into `#root` via `createRoot` | Core application entry point. |
| `src/renderer/src/App.tsx` | `default function App` | `src/renderer/src/main.tsx` | Primary layout & state coordinator | Manages presentation state, modals, theme, and controllers. |
| `src/renderer/src/components/PresenterHUD.tsx` | `export function PresenterHUD` | `src/renderer/src/App.tsx` | Rendered on stage during active presentation mode | Real-time heads-up display showing tracking status, intentional dwell charge progress, and pause toggle. |
| `src/renderer/src/components/SlideViewer.tsx` | `export const SlideViewer` | `src/renderer/src/App.tsx` | Rendered on stage when PDF is loaded | Main presentation canvas, viewport dimension calculator, PDF page renderer, jump-to-slide, and blackout overlay. |
| `src/renderer/src/components/SlideThumbnail.tsx` | `export function SlideThumbnail` | `src/renderer/src/App.tsx` | Rendered in slide rail for each page | Thumbnail rendering with `IntersectionObserver` viewport virtualization. |
| `src/renderer/src/components/CameraPreview.tsx` | `export function CameraPreview` | `src/renderer/src/App.tsx` | Rendered inside camera setup drawer | Live camera feed and poster placeholder preview. |
| `src/renderer/src/engine/pdfEngine.ts` | `loadPresentationFromBuffer`, `PresentationDocument` | `src/renderer/src/App.tsx`, `SlideViewer.tsx`, `SlideThumbnail.tsx`, `tests/presentation.test.mjs` | Core PDF processing engine | Handles PDF parsing, page rendering, canvas scaling, and queue serialization. |
| `src/renderer/src/engine/gestureEngine.ts` | `GestureEngine`, `DEFAULT_GESTURE_CONFIG`, types | `src/renderer/src/engine/smartSpectraController.ts`, `tests/gestureEngine.test.mjs` | Intentional eye gesture detector | Implements dwell advance ($\ge 350\text{ ms}$), refractory cooldown (1.2s), double-blink rewind, and noise rejection. |
| `src/renderer/src/engine/smartSpectraController.ts` | `SmartSpectraController` | `src/renderer/src/App.tsx` | Native SDK & telemetry manager | Connects `@smartspectra/node-sdk` metrics to the gesture engine and feeds status to UI. |
| `src/renderer/src/utils/audioChime.ts` | `audioFeedback` | `src/renderer/src/App.tsx` | Web Audio feedback synthesizer | Plays non-blocking procedural sine chimes for slide navigation without audio files. |
| `src/renderer/src/types/index.ts` | TypeScript types/interfaces | `App.tsx`, `PresenterHUD.tsx`, `smartSpectraController.ts` | Shared type declarations | Strict contracts for camera, gesture, and presentation state. |
| `src/renderer/src/styles/globals.css` | CSS tokens & styles | `src/renderer/src/main.tsx` | Global stylesheet | Hallmark-compliant design tokens, dark/light studio themes, and layout rules. |
| `src/renderer/src/vite-env.d.ts` | Ambient declarations | Vite / TypeScript | TypeScript environment bindings | Types for Vite client and `__smartspectraBridge`. |

### Finding
- **Zero old or orphaned components exist.** There are no obsolete pages, unused router configurations, or deprecated layouts.
- **Strict TypeScript Compliance:** With `"noUnusedLocals": true` and `"noUnusedParameters": true` enforced in `tsconfig.json`, any unreferenced component, variable, or parameter in `src/` causes an immediate compilation failure. `tsc --noEmit` exits with `0`.

---

## 2. Static Asset Audit

| Asset Path | Format / Size | Referenced Locations | Purpose & Justification |
| :--- | :--- | :--- | :--- |
| `public/camera-preview-poster.svg` | SVG (329 B) | `src/renderer/src/components/CameraPreview.tsx` (`poster="/camera-preview-poster.svg"`) | Displayed as poster frame in video preview before stream is attached. |
| `public/glimra-sample-deck.pdf` | PDF (6.6 kB) | `tests/presentation.test.mjs`, bundled desktop client | Automated integration test fixture verifying PDF import, page counting, and canvas rasterization; bundled as a default sample deck for presenters. |

### Font & Audio Asset Verification
- **Fonts:** Glimra employs zero custom font downloads (`.woff2`, `.ttf`). All typography uses declared system font stacks (`--font-sans` and `--font-mono`) in `globals.css` to ensure instant zero-latency loading.
- **Audio Files:** Zero static sound files (`.mp3`, `.wav`) are stored in the repository. Presenter audio feedback is synthesized directly via the Web Audio API (`OscillatorNode` / `GainNode`).
- **Orphaned Screenshots Cleaned:** 10 temporary review screenshots (`.hallmark/shots/*.png`) were removed from the working tree and permanently excluded in `.gitignore`.

---

## 3. Dependency Audit

All 5 runtime dependencies and 10 development dependencies in `package.json` were scrutinized against runtime imports and build steps:

### Runtime Dependencies (`dependencies`)
| Dependency | Version | Active Usage in Codebase | Status |
| :--- | :--- | :--- | :---: |
| `@smartspectra/node-sdk` | `^3.4.0` | `src/main/main.ts`, `src/preload/preload.ts`, `smartSpectraController.ts`, `tests/foundation.test.mjs`, `tests/sdk-diagnostic.mjs` | **RETAINED** (Core SDK) |
| `lucide-react` | `^1.16.0` | All 17 imported icons rendered in `App.tsx` and `PresenterHUD.tsx` | **RETAINED** (Icons) |
| `pdfjs-dist` | `^4.10.38` | `src/renderer/src/engine/pdfEngine.ts`, `tests/presentation.test.mjs` | **RETAINED** (PDF viewer) |
| `react` | `^18.3.1` | Core UI state and component lifecycle across `src/renderer/` | **RETAINED** (Framework) |
| `react-dom` | `^18.3.1` | `src/renderer/src/main.tsx` DOM root mounting | **RETAINED** (Mounting) |

### Development Dependencies (`devDependencies`)
| Dependency | Version | Active Usage in Tooling | Status |
| :--- | :--- | :--- | :---: |
| `@types/node` | `^22.10.2` | TypeScript typing for Node built-ins (`node:path`, `node:fs`, `node:child_process`) | **RETAINED** |
| `@types/react` | `^18.3.12` | React 18 TypeScript type definitions | **RETAINED** |
| `@types/react-dom` | `^18.3.1` | React DOM 18 TypeScript type definitions | **RETAINED** |
| `@vitejs/plugin-react`| `^4.3.4` | Vite JSX runtime compilation | **RETAINED** |
| `electron` | `^43.8.7` | Desktop shell executable runtime | **RETAINED** |
| `electron-builder` | `^26.18.0` | Linux AppImage, Windows NSIS, and macOS packaging | **RETAINED** |
| `typescript` | `^5.7.2` | Static type checker (`tsc`) | **RETAINED** |
| `vite` | `^6.0.3` | Bundler and dev server | **RETAINED** |
| `vite-plugin-electron`| `^0.29.0` | Electron main and preload Vite integration | **RETAINED** |
| `vite-plugin-electron-renderer`| `^0.14.6` | Polyfills Node/Electron IPC APIs for the renderer | **RETAINED** |

**Vulnerability Audit:** `npm audit` was executed: **found 0 vulnerabilities**.

---

## 4. Dead Code & Obsolete CSS Elimination

A complete AST and token scan of `src/` and `globals.css` was performed:

### Confirmed Dead Code Removed
1. **Dead Class Method `AudioFeedbackController.getEnabled()`:**
   - **File:** `src/renderer/src/utils/audioChime.ts`
   - **Reason:** Never called anywhere; sound feedback enable/disable toggle in `App.tsx` is tracked in React state and set via `audioFeedback.setEnabled(enabled)`.
   - **Action:** Deleted dead method.
2. **Dead CSS Selector `.rail-slide-number`:**
   - **File:** `src/renderer/src/styles/globals.css`
   - **Reason:** Leftover from earlier prototype; `SlideThumbnail.tsx` uses `.rail-page-label`.
   - **Action:** Deleted rule.
3. **Dead CSS Selector `.panel-overline`:**
   - **File:** `src/renderer/src/styles/globals.css`
   - **Reason:** Camera setup drawer header was refactored during the Studio redesign; `.panel-overline` was no longer referenced in JSX.
   - **Action:** Deleted rule.
4. **Duplicate CSS Rules Merged:**
   - Consolidated split rules for `.studio-topbar`, `.studio-brand`, `.studio-stage`, `.welcome-stage`, `.camera-panel`, and `.camera-preview`.

---

## 5. Items Retained and Why

- **`scripts/test-runner.mjs`:** Custom ESM test runner utilizing Node's native `node:test`. Required because GitHub Actions runner environments on Ubuntu require explicit file path lists rather than glob shell expansions.
- **`tests/foundation.test.mjs`:** 4 automated tests verifying presence of core documentation, zero committed credentials, native C API export surface, and build directories.
- **`tests/gestureEngine.test.mjs`:** 9 automated tests verifying intentional dwell thresholds, cooldown windows, double-blink rewind, gap bounds, pause/face loss disarming, and sensitivity configuration.
- **`tests/presentation.test.mjs`:** 3 automated tests testing PDF parsing, page extraction, state machine clamping, and corrupted buffer handling.
- **`tests/sdk-diagnostic.mjs`:** 4 diagnostic tests exercising native `libsmartspectra_capi.so` initialization, camera hardware enumeration, custom input lifecycle, and Protobuf metric decoding.
- **`docs/` Suite:** Complete engineering documentation (`MASTER_PLAN.md`, `PROGRESS.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `DESIGN_SYSTEM.md`, `RELEASE_CHECKLIST.md`, `CAMERA_TESTING_PROCEDURE.md`, `PACKAGING_AND_INSTALLATION.md`).

---

## 6. Uncertain Items Requiring Review

**Zero uncertain items identified.**  
All 13 files in `src/renderer/src/`, both Electron process scripts in `src/main` and `src/preload`, both static assets in `public/`, and all 15 dependencies are verified active and necessary.

---

## 7. Final Verification Suite Results

All checks were executed in the Linux audit environment with 100% pass rates:

### 1. Static Type Check (`npx tsc --noEmit`)
```bash
$ npx tsc --noEmit
# Exit Code: 0 (Zero type errors, zero unused variables or parameters)
```

### 2. Automated Test Suite (`npm test`)
```bash
$ npm test
✔ Glimra Foundation — Core Documentation Suite (6.17ms)
✔ Glimra Foundation — Security Audit (No Committed Credentials) (0.97ms)
✔ Glimra Foundation — SmartSpectra SDK Native Export Surface (92.04ms)
✔ Glimra Foundation — Build Artifacts Generated (0.39ms)
✔ M3 Gesture Engine: Involuntary Blinks (<350ms) are Ignored (2.67ms)
✔ M3 Gesture Engine: Unstable Biometric Samples Are Discarded (0.37ms)
✔ M3 Gesture Engine: Non-monotonic & Stalled Timestamps Handled Safely (0.33ms)
✔ M3 Gesture Engine: Intentional Prolonged Blink (400ms) Advances Slide (1.01ms)
✔ M3 Gesture Engine: Refractory Cooldown Suppresses Double Advances (0.70ms)
✔ M3 Gesture Engine: Verified Double Blink Triggers Previous Slide (0.57ms)
✔ M3 Gesture Engine: Double Blink Rejects Inappropriate Gaps and Durations (2.46ms)
✔ M3 Gesture Engine: Pause and Face Loss Disarm Processing Immediately (0.49ms)
✔ M3 Gesture Engine: Dynamic Sensitivity Tuning via updateConfig (0.58ms)
✔ M2 Presentation Engine: Real PDF Document Import & Page Count (117.55ms)
✔ M2 Presentation Engine: Slide Navigation State Machine (1.45ms)
✔ M2 Presentation Engine: Corrupted Buffer Error Handling (3.86ms)
ℹ tests 16, suites 0, pass 16, fail 0, duration_ms 279.3ms
```

### 3. Production Build (`npm run build`)
```bash
$ npm run build
✓ 2113 modules transformed.
dist/index.html                              0.42 kB │ gzip:   0.30 kB
dist/assets/pdf.worker.min-yatZIOMy.mjs  1,375.84 kB
dist/assets/index-eLgRKU_5.css              14.48 kB │ gzip:   3.38 kB
dist/assets/index-CBPOd8Iy.js              702.24 kB │ gzip: 193.23 kB
dist-electron/main.js                        2.84 kB │ gzip:   1.31 kB
dist-electron/preload.js                     0.56 kB │ gzip:   0.26 kB
✓ built in 6.97s
```

### 4. Hallmark Design Audit (`npm run lint:hallmark`)
```bash
$ npm run lint:hallmark
sloplint: clean. 0 FAIL, 0 REFLEX, 0 WARN across 7 file(s).
```

### 5. Dependency Vulnerability Audit (`npm audit`)
```bash
$ npm audit
found 0 vulnerabilities
```

---

## 8. Physical Hardware & Public Readiness Status

In strict adherence to repository integrity rules:
1. **Physical Webcam Testing:** Marked `BLOCKED` in WSL2 because `/dev/video*` is not exposed. Live camera verification must be executed on a physical machine following [`docs/CAMERA_TESTING_PROCEDURE.md`](CAMERA_TESTING_PROCEDURE.md).
2. **Presage Live Cloud Session:** Marked `BLOCKED` until authenticated with a valid API key from `physiology.presagetech.com`.
3. **Packaged AppImage Launch on Clean OS:** Marked `NOT YET VERIFIED` until independently verified on a clean Linux desktop environment.
