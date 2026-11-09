# Live Windows camera acceptance test

Updated November 9, 2026. Do not use screen recordings or simulated landmarks as substitutes for this real-camera verification.

## Preparation

1. Close the Windows Camera app, Teams, Zoom and other software using the webcam. Use steady front lighting, and keep only one presenter in view.
2. Run `git pull origin main`, `npm ci`, `npm run build`, `npm test`, then `npm run dev`.
3. Open an actual multipage PDF. Keep the presenter on a middle page (not the first/last) and ensure the PDF is zoomed enough to scroll.
4. Enter a valid Presage SmartSpectra API key in Settings. Enable camera control after reading the consent notice. The native SDK may consume credits. Never paste the key in logs or a demo.

## Real-world checks

- **Signal proof:** Presage SDK becomes `kRunning` and shows live, stable facial-landmark sample counts. A running SDK *without* a detected face is not yet a ready gesture tracker.
- **One natural movement:** From a relaxed posture, make a gentle head turn left/right. Check exactly one next/previous slide event; do not exaggerate neck movement.
- **PDF-only scroll:** Nod up/down while the current PDF page has overflow. Content moves inside that page; the slide counter remains unchanged.
- **Neutral and repeat:** Return to a comfortable position, repeat turns/nods 15–20 times. Holding a pose must not repeatedly jump slides.
- **Handover:** Presenter A steps completely out of the frame. Presenter B steps in alone, waits for new face tracking, and then controls slides. Try Recenter under Camera Setup only if the automatic baseline does not recover.
- **Pause/disconnect:** Press Space/P and confirm no gesture commands. Resume and confirm fresh SDK events. Disconnect and ensure the native child and camera both stop. Reconnect with explicit consent.
- **Stability:** Run a normal presentation for at least five minutes with head/scroll controls; note camera-frame warnings, processing error 8, fake ready status or stranded worker processes.
- **Optional Eyes mode:** Only call it verified if live SmartSpectra blinking produces intentional actions reliably; our last independent diagnostic observed zero detected blink starts.

## Evidence to capture

A short screen recording should show both the presenter and the live app; the HUD's Details should show real Presage signal status and gesture labels. Capture only safe logs: `kRunning`, valid landmark count, quality warnings and error code. Do not publish actual API keys, raw camera frames outside the consented demo, raw face coordinates or biometric payloads.

## Acceptance gates

Pass requires real SDK-derived head commands, single-trigger behavior, scroll isolation, a successful presenter handoff or a clearly documented limitation, and reliable stop/reconnect. A green Linux/Windows build **does not prove** physical-camera behavior. See [Release Checklist](RELEASE_CHECKLIST.md).
