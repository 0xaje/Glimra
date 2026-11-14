# Glimra

## Watch the demo

[![Watch the Glimra demo on YouTube](https://i.ytimg.com/vi/poCkYjcC2ss/hqdefault.jpg)](https://youtu.be/poCkYjcC2ss)

[Watch the full 2:32 demo](https://youtu.be/poCkYjcC2ss) · [Jump to the split-screen live test at 1:32](https://youtu.be/poCkYjcC2ss?t=92) · [Glimra website](https://glimra-studio.flutteringpeach8.chatgpt.site)

The demo walks through setup and camera consent, then shows the presenter and desktop side by side so you can see the head movement and the slide response together.

## Download Glimra

[![Windows x64 installer](https://img.shields.io/badge/Windows%20x64-Installer-C93737?style=for-the-badge)](https://github.com/0xaje/Glimra/actions/runs/43540677030/artifacts/14092266652)
[![Ubuntu x64 AppImage](https://img.shields.io/badge/Ubuntu%20x64-AppImage-E5A400?style=for-the-badge)](https://github.com/0xaje/Glimra/actions/runs/43540677030/artifacts/14092465040)
[![License MIT](https://img.shields.io/badge/License-MIT-238636?style=for-the-badge)](LICENSE)

These ZIPs come from the [official GitHub Actions build](https://github.com/0xaje/Glimra/actions/runs/43540677030). Sign in to GitHub to download them.

| Platform | Install |
| --- | --- |
| Windows x64 | Extract the ZIP and run the included installer. The installer is unsigned, so Windows may display an unknown-publisher warning. |
| Ubuntu x64 (22.04+) | Extract the ZIP, mark the AppImage executable, then open it. Packaged camera operation on Ubuntu still needs live verification. |

**Control without a touch.** Glimra is a desktop app for presenting PDFs with deliberate head movements, built with the Presage SmartSpectra SDK.

## The problem

Changing slides can interrupt a lesson, talk, or workshop when the presenter has to reach for the keyboard. Glimra gives teachers, speakers, trainers, and people with limited hand mobility another way to navigate a presentation. A gentle head turn changes slides. A nod scrolls the current page when there is content to scroll. Keyboard navigation is also available.

## Build and run from source

You need Node.js 22.12 or newer and npm. For hands-free control, you also need a webcam and a [Presage SmartSpectra API key](https://physiology.presagetech.com/).

```bash
git clone https://github.com/0xaje/Glimra.git
cd Glimra
npm ci
npm run dev
```

1. Add your Presage API key in **Settings**.
2. Choose **Open presentation** and select a PDF. You can use the [sample deck](public/glimra-sample-deck.pdf).
3. Open the camera setup, connect the camera, and choose **Enable camera control** in the consent dialog. Use **Head** mode and wait for tracking to be ready.
4. Turn your head gently left or right to change slides. Use **Recenter** if needed. You can also use the left and right arrow keys.

Windows installer and Linux AppImage packaging are configured in CI. See the [packaging notes](docs/PACKAGING_AND_INSTALLATION.md) and [camera acceptance checklist](docs/CAMERA_TESTING_PROCEDURE.md) for platform and verification details.

## How live signals drive the presentation

1. The [native camera worker](src/main/presageNativeWorker.cjs) starts a SmartSpectra session in a separate Node process after camera consent. It reads live facial landmarks from the SDK.
2. The [head motion detector](src/main/presageHeadMotion.cjs) uses stable landmark samples to estimate movement relative to a resting position. It filters unstable samples and rearms after the presenter relaxes, so a held turn does not repeatedly advance slides.
3. The [Electron bridge](src/preload/preload.ts) delivers gesture events and tracking status to the renderer. The [presentation controller](src/renderer/src/engine/presageNativeController.ts) routes them to slide navigation or scrolling. PDF.js renders the document locally.

Head mode is the default and is shown in the Windows demo. The optional Eyes mode reads live SDK blink detections, but its blink controls still need hardware verification. See the [architecture](docs/ARCHITECTURE.md) and [verification notes](docs/SDK_VERIFICATION.md) for details.

## Camera consent and data handling

Camera capture starts after you explicitly enable camera control. **Disconnect camera** stops the capture session. **Pause** stops gesture commands while leaving capture active. Glimra processes camera frames locally through the native SDK and does not record or upload footage or facial landmarks. Derived gesture signals are held in memory, and PDFs are rendered locally.

The app disables SDK telemetry in its configuration. Presage authentication and metering may still require network access. If you save your API key, Glimra uses Electron's OS-backed secure storage where supported. See the [full privacy disclosure](docs/PRIVACY.md).

## Development checks

```bash
npm run build
npm test
npm run lint:hallmark
```

Built for the [Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04). Released under the [MIT License](LICENSE).
