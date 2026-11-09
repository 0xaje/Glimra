# Glimra — full repository audit and independent judging report

**Audit date:** November 9, 2026  
**Repository:** https://github.com/0xaje/Glimra  
**Branch:** `main`  
**Review baseline:** `9e7d00abe9c583b3b5211e3f747daf985e0bfd74`
**Architecture:** Windows/Electron + React/TypeScript + PDF.js + native official Presage SmartSpectra Node SDK  
**Type:** Source-level, dependency, frontend, backend, release, privacy and challenge-rule audit, with public GitHub CI evidence and presenter-provided real hardware reports. This is **not** a penetration test or a certified independent in-person user study.

## Executive decision

**Worth submitting after finishing the required acceptance work: YES. Ready to submit today: NO.**

**Provisional, non-organizer judging estimate: 74 / 100.** The judges publish criteria but do not prescribe our weights. This review applies 40 points to underlying technology, 35 to usability, and 25 to originality, The score evaluates the implementation and evidence available for review. The completed entry package is a separate eligibility gate.

| Criterion | Score | Assessment |
| --- | ---: | --- |
| Use of underlying technology | **33 / 40** | The real native Presage SDK is foundational, not decorative. The repository records real 478-point landmark samples, and the presenter reports successful head-driven PDF interaction. Eyes mode remains unverified; clean installer and long-session proof incomplete. |
| Usability and experience | **23 / 35** | Clear touch-free real-world need, PDF navigation and in-page scroll, presenter handoff/recenter and accessible keyboard fallback. Camera-start cancellation, keyboard focus handling, and missing clean-install and long-session evidence reduce the score. |
| Originality and creativity | **18 / 25** | Facial head-motion PDF presentation with real Presage integration is a coherent idea, but hands-free slide control exists elsewhere; originality relies on refined in-PDF scrolling, low-effort control and thoughtful consent. |
| **Total** | **74 / 100** | Solid entry potential, not a guaranteed winner. A polished demo and strong reliability evidence could plausibly raise this to the mid/high 80s. |

**Submission eligibility vs. readiness:** The first commit reachable from main is `d8517f7`, dated November 7, 2026 at 1:18 a.m. WAT, inside the entry window. The official rules require **actual development** to start during the contest, not simply a new repository. Nigeria is not named among the general contest's excluded jurisdictions, but individual export-control, age, DEV membership and employer-policy conditions must still be checked personally. Only a complete submission can enter judging.

## 1. Audit method and scope

Inspected the current tracked GitHub tree (source, scripts, tests, docs, assets, configuration, dependencies and CI), the native Presage controller and worker, React UI/PDF pipeline, credential storage, and the official DEV/Presage rules. CI validates compile, design lint and Node tests on Linux, with unsigned Windows NSIS and Linux packaging. The presenter independently tested the real Presage Windows camera and reports that head-controlled presentation now works with substantial improvements.

**Limits:** This audit cannot personally run the webcam, inspect unpublished Windows system logs, verify app startup on a clean second PC, inspect Presage's internal source, or verify the user's work/employment eligibility. No vendor SDK performance guarantee or win probability can be deduced from unit tests.

## 2. Dead code removed in earlier commits

| Removal / correction | Reason |
| --- | --- |
| `src/renderer/src/engine/gestureEngine.ts` | Former browser-renderer blink engine is no longer used by the native SDK worker. Its type contract moved into the active native controller. |
| `tests/gestureEngine.test.mjs` | Tested the obsolete engine, NOT real Eyes-mode processing. Keeping these passing tests would falsely inflate native test confidence. |
| `tests/sdk-diagnostic.mjs` | Unused by the `*.test.mjs` test runner; relied on dummy-key/synthetic SDK inputs. Real native SDK diagnostics are retained in `scripts/`. |
| `public/camera-preview-poster.svg` | No browser camera preview exists in native-only capture. |
| CSS `.camera-preview` and `.camera-preview-video` | Unused after removal of the old camera-preview component; compared CSS selectors to active JSX. |
| Legacy `hand-swipe` / `none` event type members | Not emitted by the live Presage-only native pipeline. |
| Blink HUD `chargeRatio`, progress bar and callback | No real native charging progress was emitted; the display suggested nonexistent processing feedback. Eyes guidance now avoids fake progress. |
| `docs/LIVE_GESTURE_VERIFICATION.md` | Obsolete experiments and patch history referencing the removed renderer/MediaPipe worker. Replaced by a current live camera acceptance procedure. |
| Old audit report and outdated build/privacy/architecture statements | Replaced or marked as historical to keep the public repository honest. |
| Windows CI auto-publish behavior | Not a dead runtime feature, but an unnecessary release action that caused installer CI failure. Windows packaging now sets `--publish never`. |

**Not removed because they are legitimately used:** `@smartspectra/node-sdk`, React, Electron, PDF.js, Lucide, PDF.js worker, audio chimes, `public/glimra-sample-deck.pdf` (PDF test asset), native standalone diagnostics and the Hallmark design kit (used by CI lint). The `.agents/skills/hallmark/` reference library is development tooling, not part of the app runtime; do not delete it while depending on `lint:hallmark`.

### Follow-up cleanup

- Removed the unused fullscreen-state and saved-key existence queries across the main process, preload, and renderer types. The active fullscreen toggle and encrypted credential read/write paths remain available.
- Removed two native packet counters that had no renderer consumer, a redundant state assignment, and the unused signal source field. The live stable-landmark count and standalone diagnostics still provide sensing evidence.
- Removed the unused renderer build plugin, obsolete Rollup externals, and the environment example for variables the app no longer reads. The active native worker is packaged separately and diagnostics use `PRESAGE_API_KEY`.

## 3. Frontend and PDF audit

**Confirmed strengths**

- Application is a genuine desktop PDF presenter, not merely a sample metrics dashboard.
- Clear landing/Open PDF, page thumbnails (lazy via IntersectionObserver), next/previous controls, keyboard, fullscreen, blackout, light/dark appearance, gesture status and Settings.
- PDF pages rendered by `pdfjs-dist`; per-page up/down gestures are routed into the current PDF's scroll area rather than skipping page numbers.
- Presentation controls work without camera consent as keyboard/mouse fallbacks.
- Camera consent and data handling are shown before starting native capture; a simple "Recenter" action assists presenter handoff.

**Remaining issues / recommendations**

| Priority | Finding | Recommendation |
| --- | --- | --- |
| **P0** | Real SDK source is not visually evident enough to a first-time judge. HUD Details reports native status/counts but no concise proof panel. | Show "Presage active", live facial-landmark sample count, tracked/lost state and last accepted gesture in a small truthful panel. Never render fake biosignals or raw coordinates. |
| **P0** | Face acquisition on a second presenter and repeated comfortable motion are not independently stress-verified. | Execute the 5-minute real Windows acceptance procedure with two people, lighting changes, pause/resume and disconnect. Record exact outcomes. |
| **P1** | No camera preview in native mode, reducing confidence that the presenter is within view. | Prefer clear Presage-powered "face found / no face / multiple faces" guidance and recenter; do not open a second MediaPipe camera pipeline merely to create a preview. A real SDK-supported video output could be evaluated later. |
| **P1** | Settings contains opt-in Eyes timing and calibration, but live blink detection previously produced zero confirmed starts. | Keep it clearly labeled optional/unverified until actual SmartSpectra blinks are observed; avoid centering the final demo on it. |
| **P2** | `App.tsx` remains a large monolithic file and both App/footer and SlideViewer/fullscreen maintain elapsed timers. | Separate Settings, Guide, camera consent and timer orchestration once the live Windows functionality is fully stable. Don't refactor the working presenter only for a cleaner file count. |
| **P1** | Consent and Settings dialogs declare modal semantics, but source review found no focus trap, focus restoration, or guard for app-wide presentation shortcuts while a dialog is open. | Verify with keyboard only. Keep focus in the dialog and suppress deck commands until dismissal. |
| **P2** | PDF rendering and zoom have limited automated browser-level coverage. | Later test large/malformed PDFs, window resize, zoom transitions and page-change race conditions. Current Node tests are not Electron end-to-end tests. |

## 4. Native backend, security and dependency audit

**Confirmed good design**

- Only the official `@smartspectra/node-sdk` is used for automatic human sensing. `useCamera(CameraSelection.default)` runs inside a supervised Node child process, avoiding the old high-overhead renderer-to-main pixel transfer.
- Real `face.landmarks` stability/reset/timestamps drive the head-command state machine; inferred direction, metric counts and quality state cross bounded IPC, not whole biometric arrays or video frames.
- The head engine has movement smoothing, rearming, false-positive protection, loss/reacquisition logic, and mathematical tests. Native samples were verified on the real Windows webcam.
- SDK telemetry is explicitly disabled (`enableTelemetry: false`), with error and face-state reporting.
- Camera startup requires user consent and sender validation; connecting/closing triggers native child cleanup.

**Risks identified**

| Severity | Finding | Status / action |
| --- | --- | --- |
| **HIGH — corrected** | Old fallback wrote Presage API keys as **plaintext** when the OS keychain was unavailable; retrieval could read them back. | Removed plaintext fallback, now fails closed. Credential IPC is main-window scoped. Settings displays secure-save errors. Old historical local files should be considered for manual cleanup if an insecure-backend machine was ever used. |
| **HIGH — fixed in source** | A pending start could outlive consent withdrawal or compete with another start. | Stop and consent withdrawal invalidate pending starts. The latest authorized start waits for worker closure and rechecks consent before launching. Installed Windows acceptance is pending. |
| **MEDIUM — open** | Electron BrowserWindow still explicitly uses `sandbox: false`, a leftover justification from the retired renderer SDK preload. | Test sandboxed preload and native IPC on Windows; enable `sandbox: true` if compatible, then rerun complete acceptance. |
| **MEDIUM — open** | Clean Windows installer may differ from local `npm run dev`: app.asar, native runtime/DLL resolution, child process packaging and SmartScreen warning. | Windows CI now builds installer. Install and test that artifact on a clean Windows computer before claiming production-ready distribution. |
| **MEDIUM — open** | Native blink path has not produced verified real blink events in the independent diagnostic. | Run dedicated actual SDK Eyes calibration test; either prove it or describe it as experimental. |
| **LOW — corrected** | Blink calibration could leave the prior eye-closed flag true on a completed practice cycle. | Fixed completed calibration edge state in native worker; real Eyes test remains necessary. |
| **LOW — open** | Old documentation still preserved in historical master plans/packaging notes can be mistaken for current instructions if the header is ignored. | Added historical notices, updated the current architecture/privacy/checklist; treat the native audit as source of truth. |

**Version/dependency facts:** `@smartspectra/node-sdk` is a required runtime dependency, as are React, React DOM, PDF.js and Lucide. Electron, Vite, TypeScript, Electron Builder and Hallmark linting are used to build/test/package. Do not delete a dependency solely because a text search fails to find it in the frontend; some belong to build configuration or native runtime.

## 5. Challenge qualification and positioning

Official challenge dates: **November 4–22, 2026**. Submission deadline: **November 22, 11:59 PM PST**. The entry must have a functional real-SDK signal, public repository, setup instructions, demo video, an English DEV post using `#presagechallenge`, and an explicit consent/data-handling/telemetry/retention/deletion statement. Individuals 18+ only, one entry per person. No medical claims or covert monitoring.

**Fit:** The true SmartSpectra landmark stream powers real PDF slide and scroll controls; that matches the underlying-technology rule. Head movements are acceptable derived actions from a documented SDK facial-landmark signal. **No need to add pulse/HRV/breathing just to appear technical**. Presage does not publish hand landmarks in its official face metrics; adding MediaPipe hand swipes as a headline would dilute the strict Presage-only concept.

**Best competitive category:** **Best Thoughtful Real-World Use**: an accessible touch-free presentation tool with explicit consent, local sensing, manual fallback and a clear productive use. Also enter Best Overall. Most Creative or Delightful Use is possible but less compelling unless the final demo adds a distinctive verified delight.

**Critical eligibility check:** Public repository date is evidence but not proof the code itself started in the contest window. Read https://dev.to/page/official-hackathon-rules (especially entry requirements and employer-policy clause). Nigeria is not among the jurisdictions expressly listed as excluded; that does not override other rules, sanctions restrictions or individual circumstances.

**Not ready to submit today:** The user has not supplied a finished DEV post/video, final clean-machine/long-session acceptance evidence, or proven Eyes behavior. A polished codebase without the required submission package may be ineligible or unjudgeable. Judges explicitly check that the public code **and video** show live Presage use.

## 6. Final priority plan: finish, don't expand

1. **P0: Freeze the native Head sensing path.** Do not reintroduce MediaPipe/hand tracking, add a new gesture engine or change already comfortable thresholds without real failure evidence.
2. **P0: Finish Windows acceptance.** Pull latest main, run `npm ci`, `npm run build`, `npm test`, and then run a 5+ minute real-camera Head presentation; verify page navigation, in-page scroll, face handoff, pause/resume, recenter and disconnect. Include disconnect during startup and simultaneous start requests in the acceptance checks. Repeat on a clean installed Windows build.
3. **P0: Demonstration proof.** Display genuine source state and sample counts; capture a short live camera + application video with Presage SDK running and one natural gesture producing an immediate slide and PDF scroll.
4. **P0: Consent and eligibility.** Confirm the employer-policy/individual restrictions; include the exact current data/telemetry/retention/disconnect disclosures in the submission.
5. **P0: Submit.** Write one high-quality English DEV post, include the public repository, real demo video and simple setup, select Overall and Thoughtful Real-World, and apply `#presagechallenge` before November 22 at 11:59 p.m. PST (November 23 at 8:59 a.m. WAT).
6. **P1: Eyes decision.** Only include live Eyes demonstration after confirmed real blink events. If still unreliable, focus judges on the verified Presage facial-landmark Head interaction; optional beta status must be honest.
7. **P2: Code organization and optional UX polish.** Split large App, unify duplicated timers, reassess sandbox, and prune unnecessary build plugin only after protecting the tested Windows installation.

**Stop condition:** Working installed app + real Presage head commands for an entire ordinary presentation + truthful source evidence + clean consent disclosure + submission package. Adding more sensors or more surface features now is less valuable than proving reliability.

## Verification for the follow-up

- Fresh `npm ci`, TypeScript/Vite build, 15/15 automated tests, and design lint passed on Linux with Node 24.22.1. The tests exercise native SDK exports and head-motion logic, plus PDF checks. They do not open a physical camera.
- `npm audit` reported zero known advisories for the installed dependency graph. The source scan found no matches for the checked common credential signatures. The automated credential check has limited pattern and file coverage.
- The [baseline CI run](https://github.com/0xaje/Glimra/actions/runs/42670167899) succeeded. A passing build and Windows artifact do not establish camera or installer behavior on a clean Windows machine.
- Vite reports a 572 kB renderer bundle and a 1.38 MB PDF worker before compression. Profile startup before spending time on bundle splitting or broad dependency upgrades.

## Source-of-truth links

- Repository: https://github.com/0xaje/Glimra
- CI runs: https://github.com/0xaje/Glimra/actions
- Official challenge: https://dev.to/challenges/presage-2026-11-04/
- Contest rules: https://dev.to/page/official-hackathon-rules
- SmartSpectra metrics: https://presagetech.com/docs/smartspectra-sdk/nodejs/metrics
- SmartSpectra Node API: https://presagetech.com/docs/smartspectra-sdk/nodejs/api-reference
- Current architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
- Privacy and camera disclosure: [PRIVACY.md](PRIVACY.md)
- Windows acceptance checks: [CAMERA_TESTING_PROCEDURE.md](CAMERA_TESTING_PROCEDURE.md)
- Release checklist: [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)

**Evidence standard:** No fabricated on-device test, hardware success, SDK blink event, or judge score is presented as an organizer-confirmed result.
