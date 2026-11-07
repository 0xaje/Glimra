# MASTER_PLAN.md — Authoritative Implementation Roadmap

**Project:** Glimra  
**Tagline:** Control without a touch.  
**Competition:** Presage SmartSpectra SDK Challenge 2026  
**Target Deadline:** November 22, 2026, 11:59 PM PST  
**Repository:** https://github.com/0xaje/Glimra.git  

---

## Milestone Status Overview

| Milestone | Title | Status | Gate Rule |
| :--- | :--- | :--- | :--- |
| **M0** | Repository & Project Foundation | **VERIFIED** | Build passes, lint clean, docs in place |
| **M1** | Real SDK Feasibility Verification | **VERIFIED** | **STOP GATE:** No gesture claims without verified real SDK output |
| **M2** | Presentation Engine Core | **VERIFIED** | PDF import, keyboard nav, fullscreen without SDK |
| **M3** | Gesture-Controlled Presentation Engine | **IN PROGRESS** | Verified real blink/gesture signals driving slide state |
| **M4** | Public User Experience & Hallmark Design | **NOT STARTED** | Plain English onboarding, privacy disclosures, WCAG AA |
| **M5** | Packaging & Clean-System Testing | **NOT STARTED** | Installable package for target OS, zero hardcoded keys |
| **M6** | Hackathon Submission & Evidence Archive | **NOT STARTED** | Real footage, Dev.to post `#presagechallenge` |

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
- **Status:** **NOT STARTED**

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
- **Verification Method:** Automated unit tests for deck store + manual test with sample presentation deck.
- **Status:** **NOT STARTED**

---

### M3 — Gesture-Controlled Presentation
- **Goal:** Connect verified SmartSpectra detection signals to slide navigation with debounce, confidence thresholds, and user feedback.
- **Scope:**
  - Integration of SmartSpectra Electron main/preload/renderer bridge.
  - Gesture recognition engine:
    - Intentional long blink (dwell time e.g., 400ms–800ms) for Next Slide.
    - Double blink or specific pattern for Previous Slide (subject to M1 feasibility).
    - Accidental blink filter (filtering standard 100–250ms involuntary blinks).
  - Visual gesture HUD: unobtrusive safelight indicator showing blink detection, hold progress, and command trigger.
  - Gesture pause/resume toggle with keyboard shortcut (`Space` or `P`).
  - Camera resource release on stop or window close.
- **Acceptance Criteria:**
  - Real user can advance slides hands-free using intentional eye gesture.
  - Accidental slide triggers during natural conversation measured and minimized.
  - HUD provides instantaneous visual feedback without obscuring presentation content.
- **Verification Method:** Timed live presentation trial with recorded metrics (total gestures, successful triggers, false triggers, missed gestures).
- **Status:** **NOT STARTED**

---

### M4 — Public-User Experience & Design Polish
- **Goal:** Create an intuitive, accessible application that ordinary non-technical presenters can understand and operate.
- **Scope:**
  - Implementation of the Hallmark Darkroom design system.
  - First-run onboarding flow explaining how eye gesture detection works.
  - Camera and privacy permissions modal with clear explanation of local processing vs cloud authentication.
  - Sensitive API key setup screen (with options for personal key entry and secure local storage via OS safeStorage).
  - Settings panel: gesture sensitivity tuning, dwell time adjustment, audio/visual cues toggle.
  - Error states and troubleshooting guide for low light, missing camera, or lost face tracking.
- **Acceptance Criteria:**
  - Plain English UI with zero developer jargon or unhelpful error codes.
  - Full keyboard accessibility and WCAG AA contrast compliance.
  - Passes Hallmark's `sloplint.mjs` Floor checks.
- **Verification Method:** Hallmark linter run + end-to-end user journey walkthrough.
- **Status:** **NOT STARTED**

---

### M5 — Packaging & Clean-System Testing
- **Goal:** Package Glimra into an installable desktop binary ready for public distribution.
- **Scope:**
  - Electron Builder configuration for Linux (`AppImage`) and Windows/macOS.
  - Correct bundling of `@smartspectra/node-sdk` native libraries into `extraResources/smartspectra`.
  - Verification that no `.env` or development secrets are included in the build output.
  - Clean environment test: install and run on a machine without dev dependencies.
- **Acceptance Criteria:**
  - Packaged application launches, runs presentation mode, and connects to camera without crash.
  - Application bundle size optimized and binary signed/packaged cleanly.
- **Verification Method:** Execution of generated package binary on clean target OS.
- **Status:** **NOT STARTED**

---

### M6 — Hackathon Submission
- **Goal:** Deliver a transparent, verified competition entry before November 22, 2026.
- **Scope:**
  - Public GitHub repository with clean commits, README, and MIT license.
  - Demonstration video showing genuine hands-free presentation control with real-time HUD and webcam feed.
  - Comprehensive Dev.to article with `#presagechallenge`.
  - Evidence documentation (`docs/SDK_VERIFICATION.md`, `docs/TEST_REPORT.md`).
- **Acceptance Criteria:**
  - All claims in the submission are backed by recorded test results and reproducible steps.
  - No simulated results or fabricated telemetry.
- **Verification Method:** Peer review of repository and submission link check.
- **Status:** **NOT STARTED**
