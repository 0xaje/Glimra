# Glimra — release and submission checklist

Updated November 9, 2026. An unchecked item is **not verified**. Build success does not substitute for a real-camera demonstration.

## Working app and SDK

- [x] React/Electron PDF open, slide navigation, PDF-only vertical scroll, zoom, fullscreen and keyboard fallback are implemented.
- [x] All automatic head commands originate from real native SmartSpectra facial landmarks. MediaPipe has been removed.
- [x] Consent is required before native camera startup; raw frames and facial coordinates do not enter React IPC.
- [x] Native SDK independently delivered 487 metrics packets / 416 stable face samples / 566 valid checks on the presenter's Windows webcam with no SDK errors.
- [x] Presenter reports working native Presage head navigation, with remaining comfort improvements needed.
- [ ] Full 5-minute live desktop run with no frozen gesture flow, false repeated page changes, or camera leaks after stop/reconnect.
- [ ] Second-presenter handoff test confirms re-centering works without reconnecting or accidental slide changes.
- [ ] Eyes mode demonstrates actual SmartSpectra blink detection. Previous independent diagnostic observed 0 blink starts; never claim this feature is verified until it works.
- [ ] Prove the visible demo's slides change **because of real native Presage signals**, not keyboard shortcuts or unit-test fixtures.

## Security and privacy

- [x] No plaintext API key storage fallback. Secure OS keychain required to persist secrets.
- [x] Camera consent gate and sender-scoped Presage start/control IPC.
- [x] SDK telemetry disabled via `enableTelemetry: false`.
- [x] Privacy notice clarifies that Pause only disables gesture commands; Disconnect or Exit stops capture.
- [ ] Review `sandbox: false` on Electron BrowserWindow; enable sandbox only after a real Windows compatibility check.
- [ ] Verify no secrets, biometric arrays or camera frames leak in logs, submitted videos, CI artifacts or screenshot descriptions.
- [ ] Check npm dependency vulnerabilities and verify lockfile reproducibility with `npm ci`.

## Build/release

- [x] Linux GitHub Actions compile, Hallmark lint and unit tests verified after Native Presage migration.
- [x] Linux AppImage packaging has succeeded in CI; clean-machine startup not verified.
- [ ] Windows CI produces and uploads unsigned NSIS installer successfully using `--publish never`.
- [ ] Windows installer installed on a clean Windows machine; native worker, DLL loads, consent dialog and PDF gestures pass. An unsigned installer may show Windows security warnings.
- [ ] Determine whether code signing and an installer icon are worth adding. They improve trust but are not mandatory for this challenge.
- [ ] Package version and README setup instructions match the actual release.

## Challenge submission

- [x] Project created during November 4–22 contest window (public repository created Nov 6, first commit Nov 7).
- [x] Real Presage SDK is integral to Head control (rather than optional background telemetry).
- [ ] Confirm individual eligibility and employer-policy compatibility; public repository timing alone does not prove all conditions.
- [ ] Record a clear 60–90s live real-camera demo with SDK signal evidence, small natural head turns, PDF changes, a nod scroll and camera disconnect.
- [ ] Include public repository, correct setup directions, limitations, privacy and telemetry disclosure.
- [ ] Publish one English DEV post using the official submission template and `#presagechallenge` before Nov 22, 2026, 11:59 PM PST.
- [ ] Enter Best Overall and Best Thoughtful Real-World Use; choose Most Creative only if the final presentation demonstrably supports that story.

Current detailed findings: [CODEBASE_AUDIT_REPORT.md](CODEBASE_AUDIT_REPORT.md). Authoritative submission rules: https://dev.to/challenges/presage-2026-11-04/ and https://dev.to/page/official-hackathon-rules.
