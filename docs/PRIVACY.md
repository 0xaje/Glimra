# PRIVACY.md — Camera Usage, Biometrics & Privacy Disclosure

Glimra takes user privacy, biometric security, and camera consent seriously.

---

## 1. Clear Consent & Camera Notice

- **No Silent Access:** Glimra will never activate the camera without explicit presenter initiation.
- **Normal Mode First:** Glimra is fully functional as a keyboard/mouse presentation viewer with camera access disabled.
- **Pre-Activation Notice:** When the presenter toggles hands-free control, Glimra presents a transparent modal explaining:
  - The camera is used solely to detect facial landmarks and eye gesture closures.
  - No video, photos, or raw audio are recorded, stored to disk, or broadcast to audience members.
  - Video frames are processed locally by the native SmartSpectra runtime.
  - Cryptographic session authentication communicates with Presage API servers to validate developer credentials and telemetry quotas.

---

## 2. Data Flow & Network Boundaries

```
[Webcam Hardware]
       │
       ▼ (Raw Video Stream)
[Local Electron Renderer / Native Engine]
       │
       ├─► (Local In-Memory Inference) ──► Eye Gesture Event (Next / Prev)
       │
       ▼ (Encrypted HTTPS / WSS API Session)
[Presage Cloud API (https://physiology.presagetech.com)]
       - Account Authentication
       - Session Authorization & Rate Limiting
       - No raw video frames are stored on Presage servers
```

---

## 3. Disabling & Instant Release

- Presenters can pause hands-free control at any instant by pressing `Space`, `P`, or clicking the Pause button.
- When hands-free control is turned off or the app is closed, all `MediaStreamTrack` instances are stopped and the native SDK session is cleanly destroyed. The physical camera indicator light turns off immediately.
