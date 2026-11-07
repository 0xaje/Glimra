# Glimra Test Report & Empirical Verification Log

This document records the empirical verification results for presentation navigation, gesture classification, hardware handling, and packaging.

---

## 1. Test Summary Matrix

| Area | Suite / Tool | Status | Execution Date | Passing / Total | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Foundation & Docs** | `tests/foundation.test.mjs` | **VERIFIED** | 2026-11-07 | 4 / 4 | Core docs present, zero committed credentials, SDK native exports, build artifacts checked. |
| **SDK Native & Protobuf** | `tests/sdk-diagnostic.mjs` | **VERIFIED** | 2026-11-07 | 4 / 4 | Native C ABI loads via koffi, REST auth handles 401 cleanly, metric 12 face.blinking decodes. |
| **Presentation Engine** | `tests/presentation.test.mjs` | **VERIFIED** | 2026-11-07 | 3 / 3 | PDF.js canvas rendering, slide boundary state machine, corrupt input handling. |
| **Gesture Engine & Intent Filter** | `tests/gestureEngine.test.mjs` | **VERIFIED** | 2026-11-07 | 9 / 9 | Involuntary blink filtering, stability gating, non-monotonic timestamps, refractory cooldown, double-blink rewind, immediate disarm, sensitivity tuning. |
| **Hallmark Design Floor** | `scripts/sloplint.mjs` | **VERIFIED** | 2026-11-07 | Clean (5/5 files) | 0 FAIL, 0 REFLEX, 0 WARN across CSS, App, HUD, SlideViewer. |
| **CI Build & Packaging** | GitHub Actions Workflow | **VERIFIED** | 2026-11-07 | Pass (2/2 jobs) | [Run 42324191241](https://github.com/0xaje/Glimra/actions/runs/42324191241): `glimra-linux-x64` (289 MB AppImage). |
| **Clean-Computer Desktop Startup** | Physical Launch | **NOT YET VERIFIED** | — | — | Pending test on independent Linux machine without dev dependencies. |
| **Live Physical Webcam Testing** | Hardware Session | **BLOCKED** | — | — | Requires physical webcam device and production Presage API key. |

---

## 2. Test Execution Details

### Gesture Engine & Intent Filter (M3 Verification)
- **Runner:** `node scripts/test-runner.mjs` -> `tests/gestureEngine.test.mjs`
- **Result:** 9/9 Passed (~3ms)
- **Verified Behaviors:**
  1. **Involuntary Blink Rejection:** Rapid physiological blinks (<300ms, tested at 180ms) produce `command === 'none'` and 0 charge accumulation.
  2. **Biometric Stability Gating:** Samples with `stable === false` (motion blur, frame flicker) are discarded immediately and cannot build charge or trigger commands.
  3. **Timestamp Integrity Protection:** Non-monotonic timestamps (`deltaUs <= 0`) and camera feed stalls (>2000ms gap) reset transient state safely.
  4. **Intentional Prolonged Blink:** Conscious eye closure sustained for $\ge 350\text{ ms}$ (tested at 400ms) cleanly triggers `'next'` slide navigation with feedback toast.
  5. **Refractory Cooldown Enforcement:** Any subsequent blink closures within 1200ms following an advance are completely suppressed (`command === 'none'`).
  6. **Double Blink Previous Slide:** Two consecutive quick closures within 450ms reliably trigger `'prev'` slide navigation.
  7. **Double Blink Duration Constraints:** Blinks longer than 280ms or separated by invalid gaps cannot form accidental double-blinks.
  8. **Immediate Disarming:** When presenter clicks Pause or presses `Space`/`P`, or when face tracking drops below `ValidationCode.kOk`, all gesture outputs are immediately silenced.
  9. **Dynamic Sensitivity Tuning:** Calling `updateConfig({ minIntentionalBlinkMs })` updates dwell thresholds at runtime (`Responsive: 320ms`, `Standard: 380ms`, `Deliberate: 460ms`).

### Presentation Engine (M2 Verification)
- **Suite:** `tests/presentation.test.mjs`
- **Result:** 3/3 Passed (~85ms)
- **Verified Behaviors:**
  1. PDF document import and canvas rendering with high-DPI scaling.
  2. Slide state boundary enforcement (bounds 1 to total slides).
  3. Corrupt buffer input rejection without application crash.

### Hallmark Design Floor (M0 & M4 Verification)
- **Command:** `node .agents/skills/hallmark/scripts/sloplint.mjs src/ --scope app`
- **Result:** Clean. 0 FAIL, 0 REFLEX, 0 WARN across 5 files:
  - `src/renderer/src/styles/globals.css`
  - `src/renderer/src/App.tsx`
  - `src/renderer/src/components/PresenterHUD.tsx`
  - `src/renderer/src/components/SlideViewer.tsx`
  - `src/renderer/src/utils/audioChime.ts`

---

## 3. Real-World Testing & Verification Protocols

Detailed step-by-step procedures have been prepared for real-world verification:

1. **Hardware Webcam Testing Procedure:**
   See [`docs/CAMERA_TESTING_PROCEDURE.md`](CAMERA_TESTING_PROCEDURE.md) for the 10-point test protocol covering live camera permissions, face detection, dwell advance, double-blink rewind, involuntary blink immunity, and hardware fault handling.

2. **Clean-Computer Packaging & Installation Guide:**
   See [`docs/PACKAGING_AND_INSTALLATION.md`](PACKAGING_AND_INSTALLATION.md) for downloading, verifying, and running `Glimra-1.0.0.AppImage` on an independent Linux machine.
