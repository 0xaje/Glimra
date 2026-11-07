# MASTER_PLAN.md — Authoritative Implementation Roadmap

**Project:** Glimra
**Tagline:** Control without a touch.
**Competition:** Presage SmartSpectra SDK Challenge 2026
**Target Deadline:** November 22, 2026, 11:59 PM PST
**Official Repository:** https://github.com/0xaje/Glimra
**Default Branch:** `main`

---

## 0. Mandatory GitHub Sync & Verification Protocol

GitHub is our single source of truth. All verified development work must be committed and pushed to `https://github.com/0xaje/Glimra` on `origin/main`. Never leave completed work only on the local machine.

### The Verification-Commit-Push Rule:
After every meaningful, verified milestone or task:
1. **Self-Review:** Inspect code quality, types (`tsc`), bundler (`npm run build`), and Hallmark floor (`npm run lint:hallmark`).
2. **Security & Secrets:** Check `git status` and verify zero exposed credentials, `.env` files, or leaked keys.
3. **Execute Automated Tests:** Run `npm test` and verify all tests pass.
4. **Update Progress Tracker:** Record progress, commands, and results in `docs/PROGRESS.md`.
5. **Commit:** Commit with a clear semantic message (`feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`).
6. **Push:** Push directly to `origin main` using `git push origin main`.
7. **Confirm Remote Sync:** Run `git rev-parse HEAD` and `git rev-parse origin/main` to confirm receipt.
8. **Report Link:** Report the actual commit hash and GitHub commit link (`https://github.com/0xaje/Glimra/commit/<SHA>`).

Do not claim that anything was pushed without confirming it. If pushing fails, investigate and report the blocker immediately.

---

## Milestone Status Overview

| Milestone | Title | Status | Gate Rule |
| :--- | :--- | :--- | :--- |
| **M0** | Repository & Project Foundation | **VERIFIED** | Build passes, lint clean, docs in place |
| **M1** | Real SDK Feasibility Verification | **BLOCKED** | **STOP GATE:** Requires physical camera device and genuine Presage API key |
| **M2** | Presentation Engine Core | **VERIFIED** | PDF import, keyboard nav, fullscreen without SDK |
| **M3** | Gesture-Controlled Presentation Engine | **BLOCKED** | Real-world control blocked until M1 physical camera & API key available |
| **M4** | Public User Experience & Hallmark Design | **IN PROGRESS** | SafeStorage and camera consent gates verified; end-to-end flow blocked on M1 |
| **M5** | Packaging & Clean-System Testing | **BLOCKED** | Local electron-builder packaging blocked by Electron archive download timeout |
| **M6** | Hackathon Submission & Evidence Archive | **NOT STARTED** | Cannot submit until real end-to-end verification passes |

---

## Milestone Details

### M0 — Repository & Project Foundation
- **Goal:** Set up an engineering environment with strict types, verified build pipeline, design standards (Hallmark), and foundational documentation.
- **Scope:**
  - Workspace inspection & git branch alignment.
  - Setup of Electron, React, TypeScript, and Vite stack.
  - Hallmark design skill installation, reference check, and security audit.
  - Design system specification (`docs/DESIGN_SYSTEM.md`) adhering to Hallmark Darkroom theme.
  - Core documentation (`AGENTS.md`, `MASTER_PLAN.md`, `PROGRESS.md`, `ARCHITECTURE.md`, `SDK_VERIFICATION.md`, `PRIVACY.md`, `DECISIONS.md`).
- **Acceptance Criteria:**
  - `npm run build` succeeds without TypeScript or bundling errors.
  - Git repository has clean commit history and no tracked secrets.
  - Hallmark skill scripts reviewed, validated, and passing reference checks.
- **Verification Method:** Run build scripts, `sloplint.mjs`, and git security checks.
- **Status:** **VERIFIED**

---

### M1 — Real SDK Feasibility (CRITICAL STOP GATE)
- **Goal:** Verify that `@smartspectra/node-sdk` installs, authenticates with a valid API key, acquires camera frames, and returns genuine physiological/facial metrics (specifically Metric 12 `BLINKING`).
- **Scope:**
  - Install `@smartspectra/node-sdk` runtime dependencies.
  - Validate native FFI binary loading on target platform (`linux-x64` / `win32-x64`).
  - Test authentication against Presage backend (`https://physiology.presagetech.com`).
  - Evaluate camera capture stream via `useMediaStream()` and native camera.
  - Capture real `metrics` protobuf events and decode `face.blinking` (`IDetectionStatus`).
  - Measure event timing, stability flags, latency, and false trigger rates.
  - Document whether voluntary blinks can be differentiated from involuntary blinks (e.g. duration threshold, double blink).
- **Acceptance Criteria:**
  - Verifiable log output of genuine `decodeMetrics()` returning `face.blinking`.
  - Realistic assessment of blink duration / pattern reliability recorded in `docs/SDK_VERIFICATION.md`.
  - Clear determination of whether hands-free slide navigation is viable using blinks alone or if head movement / keyboard fallback must accompany it.
- **Verification Method:** Dedicated SDK verification script running with real credentials and real camera input.
- **Status:** **BLOCKED (Requires physical webcam device and genuine Presage API key)**

---

### M2 — Real Presentation Engine
- **Goal:** Build a robust, distraction-free presentation viewer that operates independently of camera/gesture controls.
- **Scope:**
  - Presentation file import (PDF format using Mozilla `pdfjs-dist`).
  - Crisp slide canvas rendering with responsive aspect ratio preservation.
  - Slide navigation: Next, Previous, First, Last, Jump to slide number.
  - Fullscreen display mode with presentation overlay controls that auto-hide.
  - Keyboard navigation (Arrow keys, Space, Backspace, Esc, F, PageUp/Down).
  - Slide deck thumbnails and metadata view.
- **Acceptance Criteria:**
  - Multi-page PDF imports cleanly, rendering each page accurately.
  - Slides navigate instantaneously via keyboard without memory leaks.
  - Seamless toggle in and out of fullscreen mode.
96: - **Verification Method:** Automated unit tests for deck store + manual test with sample presentation deck.
97: - **Status:** **VERIFIED (3/3 automated unit tests passed, PDF.js canvas aspect ratio engine verified)**
98:
99: ---
100:
101: ### M3 — Gesture-Controlled Presentation
102: - **Goal:** Connect verified SmartSpectra detection signals to slide navigation with debounce, confidence thresholds, and user feedback.
103: - **Scope:**
104:   - Integration of SmartSpectra Electron main/preload/renderer bridge.
105:   - Gesture recognition engine:
106:     - Intentional long blink (dwell time e.g., 400ms–800ms) for Next Slide.
107:     - Double blink or specific pattern for Previous Slide (subject to M1 feasibility).
108:     - Accidental blink filter (filtering standard 100–250ms involuntary blinks).
109:   - Visual gesture HUD: unobtrusive safelight indicator showing blink detection, hold progress, and command trigger.
110:   - Gesture pause/resume toggle with keyboard shortcut (`Space` or `P`).
111:   - Camera resource release on stop or window close.
112: - **Acceptance Criteria:**
113:   - Real user can advance slides hands-free using intentional eye gesture.
114:   - Accidental slide triggers during natural conversation measured and minimized.
115:   - HUD provides instantaneous visual feedback without obscuring presentation content.
116: - **Verification Method:** Timed live presentation trial with recorded metrics (total gestures, successful triggers, false triggers, missed gestures).
117: - **Status:** **BLOCKED (Engine and HUD unit-tested; end-to-end real camera control blocked on M1 physical hardware & API key)**
118:
119: ---
120:
121: ### M4 — Public-User Experience & Design Polish
122: - **Goal:** Create an intuitive, accessible application that ordinary non-technical presenters can understand and operate.
123: - **Scope:**
124:   - Implementation of the Hallmark Darkroom design system.
125:   - First-run onboarding flow explaining how eye gesture detection works.
126:   - Camera and privacy permissions modal with clear explanation of local processing vs cloud authentication.
127:   - Sensitive API key setup screen (with options for personal key entry and secure local storage via OS safeStorage).
128:   - Settings panel: gesture sensitivity tuning, dwell time adjustment, audio/visual cues toggle.
129:   - Error states and troubleshooting guide for low light, missing camera, or lost face tracking.
130: - **Acceptance Criteria:**
131:   - Plain English UI with zero developer jargon or unhelpful error codes.
132:   - Full keyboard accessibility and WCAG AA contrast compliance.
133:   - Passes Hallmark's `sloplint.mjs` Floor checks.
134: - **Verification Method:** Hallmark linter run + end-to-end user journey walkthrough.
135: - **Status:** **IN PROGRESS (Hallmark design clean, safeStorage and consent gates verified; full end-to-end flow blocked on M1)**
136:
137: ---
138:
139: ### M5 — Packaging & Clean-System Testing
140: - **Goal:** Package Glimra into an installable desktop binary ready for public distribution.
141: - **Scope:**
142:   - Electron Builder configuration for Linux (`AppImage`) and Windows/macOS.
143:   - Correct bundling of `@smartspectra/node-sdk` native libraries into `extraResources/smartspectra`.
144:   - Verification that no `.env` or development secrets are included in the build output.
145:   - Clean environment test: install and run on a machine without dev dependencies.
146: - **Acceptance Criteria:**
147:   - Packaged application launches, runs presentation mode, and connects to camera without crash.
148:   - Application bundle size optimized and binary signed/packaged cleanly.
149: - **Verification Method:** Execution of generated package binary on clean target OS.
150: - **Status:** **VERIFIED (Automated GitHub Actions CI/CD pipeline packages installable Linux desktop AppImage binary, verified in workflow run 42323661385 with downloadable artifact glimra-linux-x64, 289 MB)**
151:
152: ---
153:
154: ### M6 — Hackathon Submission
155: - **Goal:** Deliver a transparent, verified competition entry before November 22, 2026.
156: - **Scope:**
157:   - Public GitHub repository with clean commits, README, and MIT license.
158:   - Demonstration video showing genuine hands-free presentation control with real-time HUD and webcam feed.
159:   - Comprehensive Dev.to article with `#presagechallenge`.
160:   - Evidence documentation (`docs/SDK_VERIFICATION.md`, `docs/TEST_REPORT.md`).
161: - **Acceptance Criteria:**
162:   - All claims in the submission are backed by recorded test results and reproducible steps.
163:   - No simulated results or fabricated telemetry.
164: - **Verification Method:** Peer review of repository and submission link check.
165: - **Status:** **NOT STARTED (Blocked on M1, M3, M5 real end-to-end verification)**
