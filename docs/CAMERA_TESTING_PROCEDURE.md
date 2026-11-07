# Glimra Real-Camera Testing Procedure & Hardware Verification Protocol

**Document Version:** 1.0.0
**Target Milestone:** M1 & M3 Physical Verification
**SDK Under Test:** Presage SmartSpectra Node.js SDK v3.4.0 (`@smartspectra/node-sdk`)
**Application:** Glimra Desktop (`com.glimra.presentation`)

---

## 1. Overview & Objective

This protocol provides an exact, repeatable, non-destructive testing procedure to evaluate Glimra's intentional eye gesture detection and slide navigation using a genuine physical webcam and live Presage SmartSpectra API session.

> [!IMPORTANT]
> **Zero Fabrication Rule:** Never record simulated camera measurements, fake gestures, or synthetic API responses as real hardware passes. If hardware or API keys are unavailable, tests must remain marked **BLOCKED**.

---

## 2. Hardware & Environmental Prerequisites

| Requirement | Specification | Status / Verification |
| :--- | :--- | :--- |
| **Physical Webcam** | Integrated laptop webcam or USB UVC webcam (minimum 720p @ 30 FPS). | Verify device node `/dev/video*` exists via `v4l2-ctl --list-devices` or OS device manager. |
| **Operating System** | Linux (native desktop with X11/Wayland), Windows 10/11, or macOS 12+. | Note: Virtual machines and WSL2 require USB camera pass-through (`usbipd`). |
| **Lighting** | Even, diffused frontal illumination (approx. 300–500 lux). | Avoid strong backlighting or direct window glare behind presenter. |
| **Presenter Positioning** | Centered 50–70 cm from camera lens; face occupies ~25–40% of frame. | Avoid extreme pitch/yaw angles (>20 degrees). |
| **Presage Credentials** | Genuine SmartSpectra API key from `https://physiology.presagetech.com`. | Required for REST session token creation. |

---

## 3. Step-by-Step 10-Point Testing Procedure

### Step 1: Application Launch & Window Initialization
1. Launch Glimra:
   - Development mode: `npm run dev`
   - Packaged AppImage: `./release/Glimra-1.0.0.AppImage`
2. **Verify:**
   - Window opens at 1280x800 with Hallmark Darkroom restrained theme (`#0c0e12`).
   - Title displays "Glimra — Control without a touch".
   - Console logs show zero IPC binding errors or missing shared object warnings.

### Step 2: Presentation Deck Import
1. In the initial stage, click **Try sample deck** (or click **Choose PDF presentation** and select a multi-page PDF).
2. **Verify:**
   - PDF.js renders Page 1 cleanly on the canvas with correct 16:9 aspect ratio and subtle drop shadow.
   - Presenter navigation bar displays slide counter `1 / N` (e.g. `1 / 5`).
   - Elapsed timer initializes at `00:00`.

### Step 3: API Key Configuration & OS SafeStorage
1. Click **Settings** in the top bar.
2. Enter the genuine Presage SmartSpectra API key in the password input.
3. Click **Save settings**.
4. **Verify:**
   - Credential is sent via Electron IPC (`glimra:store-api-key`) and encrypted by OS `safeStorage`.
   - Credential is NOT present in `window.localStorage` or renderer plain text.
   - Settings modal closes cleanly.

### Step 4: Camera Permission & Origin Consent Gate
1. Click **Enable hands-free** in the top header.
2. The **Camera access & privacy** modal must appear, explaining in-memory processing and absence of video uploads.
3. Click **Enable camera control**.
4. **Verify:**
   - Electron IPC sends `glimra:set-camera-consent(true)`.
   - Native webcam activity LED illuminates.
   - HUD overlay appears at top-right with status `Connecting to SmartSpectra…`.

### Step 5: Live Face & Eye Detection Confirmation
1. Presenter sits facing the webcam in normal posture.
2. In the HUD overlay, click **Show camera alignment** to reveal the mini-feed.
3. **Verify:**
   - Video feed displays smoothly without jitter.
   - Once SmartSpectra locks face landmarks, HUD status indicator turns solid green (`Hands-free active`).
   - Validation message reads `Tracking active` (SmartSpectra `ValidationCode.kOk`).

### Step 6: Next Slide Navigation via Intentional Dwell Blink
1. Maintain normal posture while presenting.
2. Deliberately close eyes for approximately **380 milliseconds** (a sustained, intentional blink).
3. **Verify:**
   - HUD charge progress bar fills progressively from 0% to 100% during the dwell.
   - Slide canvas advances cleanly to Slide 2 (`2 / N`).
   - HUD toast confirms `Intentional Blink (Next Slide)`.
   - Subtle high-pitch audio chime sounds (520Hz -> 660Hz).
   - 1200ms refractory cooldown activates (further immediate blinks are ignored).

### Step 7: Previous Slide Navigation via Double-Blink
1. Perform two crisp consecutive blinks in rapid succession (each blink 100–280ms, separated by 100–350ms gap).
2. **Verify:**
   - Slide canvas steps backward to Slide 1 (`1 / N`).
   - HUD toast confirms `Double Blink (Prev Slide)`.
   - Subtle low-pitch audio chime sounds (660Hz -> 520Hz).
   - Presentation does not decrement below Slide 1 (boundary protection).

### Step 8: Involuntary Blink Immunity
1. Speak aloud for 60 seconds at natural conversational cadence, blinking naturally (typical involuntary blinks last 100–250ms).
2. **Verify:**
   - Natural involuntary blinks do NOT advance or reverse slides.
   - Charge progress bar does not trigger slide changes.
   - Slide position remains exactly where the presenter left it.

### Step 9: Dwell Sensitivity Tuning
1. Open **Settings** and test each sensitivity preset:
   - **Responsive (320ms):** Deliberate short closure triggers advance; suitable for quick-paced presenters.
   - **Standard (380ms):** Default balanced dwell.
   - **Deliberate (460ms):** Requires longer deliberate closure; recommended for presenters with naturally slower blinks.
2. **Verify:**
   - Each setting updates `GestureEngine` dynamically via `updateGestureConfig()`.
   - HUD charge bar timing reflects the selected threshold.

### Step 10: Edge Cases, Fault Recovery & Manual Fallbacks
1. **Lost Face Tracking:**
   - Turn head 90 degrees away from camera or cover eyes with hands.
   - Verify HUD indicator changes from green to warning/dim, validation reads `Face not centered` or `Face lost`, and transient gesture charges are immediately zeroed.
   - Re-center face; verify tracking resumes within 500ms without false trigger.
2. **Presenter Pause / Resume:**
   - Press `Space` or `P` on keyboard (or click HUD **Pause** button).
   - Status changes to `Paused`. Deliberate blinks must NOT navigate slides.
   - Press `Space` or click **Resume**; tracking restores instantly.
3. **Blackout Screen Mode:**
   - Press `B` or `.` (period).
   - Slide stage blacks out completely with subtle message "Screen blanked".
   - Press `B` or any arrow key; slide restores instantly.
4. **Keyboard & Touch Overrides:**
   - Press `ArrowRight` / `PageDown` to advance, `ArrowLeft` / `PageUp` to step back.
   - Verify keyboard shortcuts execute immediately even if camera is active or paused.
5. **Clean Camera Teardown:**
   - Click **Hands-free active** to disable hands-free.
   - Verify camera activity LED immediately turns OFF, video stream tracks are stopped, and camera resources are released.

---

## 4. Hardware Verification Recording Template

Use this table when physical testing is performed:

```text
================================================================================
GLIMRA HARDWARE VERIFICATION TEST RECORD
================================================================================
Date: _________________________
Tester: _______________________
Machine / OS: __________________________________________________________________
Webcam Model & Resolution: _____________________________________________________
Presage SDK Version: @smartspectra/node-sdk v3.4.0
SmartSpectra Session ID: _______________________________________________________

TEST MATRIX RESULTS:
[ ] 1. Clean Application Startup:         PASS [ ]  FAIL [ ]  Notes: ___________
[ ] 2. PDF Presentation Import:            PASS [ ]  FAIL [ ]  Notes: ___________
[ ] 3. SafeStorage Encrypted Key:          PASS [ ]  FAIL [ ]  Notes: ___________
[ ] 4. Camera Permission & LED Active:     PASS [ ]  FAIL [ ]  Notes: ___________
[ ] 5. Face Tracking Lock (HUD Green):     PASS [ ]  FAIL [ ]  Notes: ___________
[ ] 6. Intentional Dwell Blink (Advance):  PASS [ ]  FAIL [ ]  (Hits/Attempts: __/__)
[ ] 7. Double-Blink Sequence (Previous):   PASS [ ]  FAIL [ ]  (Hits/Attempts: __/__)
[ ] 8. Involuntary Blink Rejection:        PASS [ ]  FAIL [ ]  (False Triggers: __)
[ ] 9. Sensitivity Presets (320/380/460):  PASS [ ]  FAIL [ ]  Notes: ___________
[ ] 10. Pause / Blackout / Disarm / Off:   PASS [ ]  FAIL [ ]  Notes: ___________

OVERALL STATUS:
[ ] VERIFIED (All 10 steps passed with real hardware)
[ ] BLOCKED  (Hardware or credentials unavailable)
[ ] FAILED   (Defects noted above)
================================================================================
```
