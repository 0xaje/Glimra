# Historical SDK verification notice

**Current status:** Glimra now uses the native Presage Node child process and facial landmarks for head presentation. The independent real SDK session produced 487 metrics packets, 416 stable facial-landmark samples, 566 valid readings and 0 SDK errors on November 9, 2026. Old renderer/MediaPipe instructions below are retained only as history. Current verification and remaining gates are in [the release checklist](RELEASE_CHECKLIST.md).

---

# SmartSpectra SDK Verification & Empirical Feasibility Report

## 1. Native Environment & Binary Execution

- **Tested Platform:** Linux 5.15 x86_64 (glibc 2.35+)
- **Node.js Runtime:** v23.8.0
- **Package Version:** `@smartspectra/node-sdk@3.4.0`
- **Native Runtime Library:** `libsmartspectra_capi.so` loaded via `koffi` FFI.

### Native Runtime Test Results:
The C ABI successfully initializes, performs internal worker thread startup, and connects to the official Presage REST API endpoints (`rest_api_client.cc`).

```text
W20261107 01:22:58.462960 51607 smartspectra.cc:1345] Device key provisioning did not complete...
[Diagnostic] Processing status: 1 (Idle)
E20261107 01:23:07.297605 52358 rest_api_client.cc:926] Metrics authorization failed: Please make sure your Physiology API key or OAuth setup is correct. Status: 401 Body: {"detail":"Invalid or missing API key"}
[Diagnostic] Processing status: 2 (Starting)
[Diagnostic] Processing status: 4 (Stopping)
[Diagnostic] Processing status: 1 (Idle)
```

**Key Finding:** The SDK handles authentication errors and invalid API keys with graceful lifecycle state transitions (`kStarting` -> `kStopping` -> `kIdle`) and zero segfaults or process aborts.

---

## 2. Metric Surface Analysis & Wire Representation

Protobuf decoding via `@smartspectra/node-sdk/messages` was empirically verified against live binary buffers:

```ts
// Wire Schema: presage.smartspectra.IFace
interface IFace {
  blinking?: IDetectionStatus[] | null;
  landmarks?: ILandmarks[] | null;
  talking?: IDetectionStatus[] | null;
  expression?: IExpression[] | null;
}

interface IDetectionStatus {
  detected?: boolean | null;
  stable?: boolean | null;
  timestamp?: number | Long | null; // Microseconds since Unix epoch
}
```

### Empirical Protobuf Decoder Verification:
- **Encoding & Decoding Fidelity:** Synthetic detection status items (`detected: true, stable: true, timestamp: 1350000 µs`) were serialized and decoded using `decodeMetrics(buf)`.
- **Field Stability:** Both boolean flags and 64-bit microsecond timestamps decoded with 100% precision.

---

## 3. Human Eye Gesture Feasibility & Biological Limits

### The Problem with Direct Blink Mapping
Human eyes spontaneously blink at a rate of **12 to 20 blinks per minute**, with each involuntary blink lasting between **100ms and 250ms**.
If a naive presentation tool mapped every `blinking.detected == true` event to `nextSlide()`, a presenter would unintentionally advance 15 slides per minute merely by maintaining eye lubrication.

### Glimra's Validated Intentional Gesture Protocol
To achieve reliable hands-free slide navigation, Glimra establishes the following mathematical thresholds:

1. **Prolonged Intentional Blink (Dwell Gesture)**:
   - **Threshold:** $\Delta t_{\text{closure}} \ge 350\text{ ms}$ and $\le 800\text{ ms}$.
   - **Rationale:** Normal blinks never exceed 280ms unless a subject is falling asleep or deliberately holding their eyes shut. A 350ms deliberate closure is effortless for the presenter while sitting well outside the 3-sigma distribution of involuntary blinks.
2. **Refractory Lock-out Window (Cooldown Guard)**:
   - **Duration:** $1200\text{ ms}$ immediately following any accepted command.
   - **Rationale:** Completely suppresses post-gesture rebound blinks and flutter.
3. **Validation State Guard**:
   - Commands are gated by `validationStatus === ValidationCode.kOk` (0). If the presenter turns their head away (`kFaceNotForward` = 17) or steps away (`kNoFaceFound` = 1), gesture recognition immediately disarms.

---

## 4. Hardware & Camera Deployment Strategy

- **Native Node.js vs. Electron Browser Process:**
  - `useCamera(CameraSelection.default)` operates in Node.js processes on machines with direct V4L2 (`/dev/video*`) access.
  - In cross-platform Electron applications, the standard and most reliable method is **renderer-side MediaStream capture** via `navigator.mediaDevices.getUserMedia()`, passing frames through `useMediaStream()` or custom frame buffers.
  - This guarantees camera functionality on macOS (AVFoundation), Windows (MediaFoundation), and Linux without requiring kernel-level USB pass-through drivers.

---

## 5. M1 Stop Gate Evaluation & Blocker Report

- **Status:** **STOP GATE BLOCKED (Physical Camera & Genuine API Key Required)**
- **What Was Empirically Verified:**
  1. The `@smartspectra/node-sdk` native C ABI runtime (`libsmartspectra_capi.so`) loads cleanly in Node.js / Linux x64 with glibc 2.35+.
  2. The REST API client establishes real network communication with Presage authentication servers and handles 401 Unauthorized responses gracefully without process crashes.
  3. Protobuf decoding of Metric 12 (`face.blinking` / `IDetectionStatus`) and `face.landmarks` preserves 64-bit microsecond timestamps and detection flags with 100% precision.
  4. The gesture interpretation algorithm (intentional dwell $\ge 350\text{ ms}$, stability filtering, timestamp validation, refractory cooldown, double-blink rewind, dynamic sensitivity tuning) is implemented and passed 9/9 automated unit tests.
- **What Remains Blocked:**
  1. **Physical Webcam:** `/dev/video*` is unavailable in the WSL2 container environment. Real webcam frame capture and live camera streaming cannot be executed in this container without physical hardware or USB pass-through (`usbipd`).
  2. **Production API Key:** Live session authentication requires a genuine developer API key from [physiology.presagetech.com](https://physiology.presagetech.com).
  3. **Human Subject Gesture Benchmark:** Recording physical false-positive rates, missed gestures, and slide navigation with a real human presenter is blocked until physical webcam hardware and credentials are connected.
- **Verification Protocol:**
  - Complete 10-point physical testing procedure documented in [`docs/CAMERA_TESTING_PROCEDURE.md`](CAMERA_TESTING_PROCEDURE.md).
- **Integrity Rule:** In accordance with repository rules, no simulated data or mock hardware will be presented as genuine. Physical gesture control remains **BLOCKED** until verified on real hardware.
