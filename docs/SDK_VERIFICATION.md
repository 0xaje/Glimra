# SDK_VERIFICATION.md — SmartSpectra SDK Verification & Evidence

**Package:** `@smartspectra/node-sdk`  
**Current Version:** `3.4.0`  
**Provider:** Presage Technologies, Inc.  
**Portal:** https://physiology.presagetech.com  

---

## 1. Native FFI Architecture Audit

`@smartspectra/node-sdk` relies on [Koffi](https://koffi.dev) to link against a C-ABI shared library (`libsmartspectra_capi.so` / `smartspectra_capi.dll` / `libsmartspectra_capi.dylib`).

Platform runtime dependencies:
- Linux x64: `@smartspectra/node-sdk-linux-x64` (glibc >= 2.35)
- Windows x64: `@smartspectra/node-sdk-win32-x64`
- macOS arm64: `@smartspectra/node-sdk-darwin-arm64`

### Verification of Native Module Packaging
In an Electron application, native libraries cannot be loaded from inside an ASAR archive.
- The `electron-builder` configuration must unpack the native libraries into `extraResources/smartspectra/`.
- In development (`npm start`), the SDK resolves the native library from `node_modules/@smartspectra/node-sdk-<platform>-<arch>/`.
- In packaged builds, `main.js` defines `process.env.SMARTSPECTRA_CAPI_PATH = path.join(process.resourcesPath, 'smartspectra', LIB)`.

---

## 2. Facial & Blink Metrics Specification

The SDK transmits metrics as protocol buffer buffers (`Metrics`), decoded using `decodeMetrics(buf)`.

### Facial Bundle (`faceMetrics`):
- Metric Code 11: `FACE_LANDMARKS`
- Metric Code 12: `BLINKING`
- Metric Code 13: `TALKING`
- Metric Code 14: `EXPRESSIONS`

### Blinking Data Structure:
When `faceMetrics` (bundle `[11, 12, 13, 14]`) is requested, the decoded object provides:
```ts
metrics.face.blinking: Array<{
  detected: boolean;       // True if eye closure / blink is detected
  stable: boolean;         // True if facial tracking confidence meets stability threshold
  timestamp: number;       // Microseconds since Unix epoch (µs)
}>
```

---

## 3. Gestural Interpretation Feasibility & Involuntary Blink Mitigation

### Critical Distinctions:
1. **Involuntary Spontaneous Blinks:**
   - Normal physiological blinks occur every 2 to 10 seconds.
   - Mean blink duration: **100ms to 250ms**.
   - These must **NEVER** trigger a slide advance.
2. **Intentional Long Blink (Dwell Gesture):**
   - The user deliberately closes their eyes for a sustained period: **400ms to 750ms**.
   - When `detected === true` remains contiguous across incoming samples exceeding the dwell threshold, the command is armed.
   - Upon eyes reopening (`detected === false`), the action executes (e.g. Next Slide).
3. **Refractory Cooldown:**
   - A minimum lockout window (e.g. 1000ms) prevents duplicate triggers while the user re-adjusts attention to the slide or audience.
4. **Talking Discrimination:**
   - SmartSpectra also emits `face.talking`. During active speech, blink patterns alter slightly; the algorithm can cross-check `talking` status if necessary.

---

## 4. STOP GATE Criteria for M1

Before marking M1 verified, the following evidence must be captured on real hardware:
1. SDK successfully initializes and authenticates against Presage with a real API key.
2. Video frames from webcam stream are accepted by the pipeline.
3. `metrics` event fires and `decodeMetrics(buf)` returns valid `face.blinking` packets.
4. Measured latency between physical eye closure and SDK `detected: true` packet receipt.
5. Measured precision of dwell duration tracking.
6. Clean shutdown test: camera hardware indicator turns off immediately when `sdk.stopAsync()` and `sdk.destroy()` are invoked.
