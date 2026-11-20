[![Website — Glimra Studio](https://img.shields.io/badge/Website-Glimra%20Studio-2563EB?style=for-the-badge)](https://glimra-studio.flutteringpeach8.chatgpt.site)
[![License — MIT](https://img.shields.io/badge/License-MIT-238636?style=for-the-badge)](LICENSE)
[![Windows — x64 installer](https://img.shields.io/badge/Windows-x64%20installer-0078D4?style=for-the-badge)](https://github.com/0xaje/Glimra/actions/runs/43540677030/artifacts/14092266652)
[![Ubuntu — x64 AppImage](https://img.shields.io/badge/Ubuntu-x64%20AppImage-E5A400?style=for-the-badge)](https://github.com/0xaje/Glimra/actions/runs/43540677030/artifacts/14092465040)
[![YouTube — Full demo](https://img.shields.io/badge/YouTube-Full%20demo-D92323?style=for-the-badge)](https://youtu.be/sRE2VN--4Dk)
[![Live demo](https://img.shields.io/badge/Live%20demo-Watch-8250DF?style=for-the-badge)](https://youtu.be/sRE2VN--4Dk)

[![Watch the Glimra demo on YouTube](https://i.ytimg.com/vi/sRE2VN--4Dk/hqdefault.jpg)](https://youtu.be/sRE2VN--4Dk)

# Glimra

**Control without a touch.** Glimra is a desktop app for presenting PDFs with deliberate head movements, built with the Presage SmartSpectra SDK.

## The problem

Technology should be accessible to everyone, but many everyday interactions still depend on physical controls.

According to the [World Health Organization](https://www.who.int/en/news-room/fact-sheets/detail/disability-and-health), approximately **1.3 billion people worldwide experience significant disability**. WHO also reports that [more than 2.5 billion people need at least one assistive product](https://www.who.int/news-room/fact-sheets/detail/assistive-technology). These figures illustrate the wider importance of accessible technology; they do **not** represent Glimra's potential user base.

For people with limited hand mobility, using a keyboard, mouse, or presentation clicker can create barriers. Research into [head-movement interfaces](https://pmc.ncbi.nlm.nih.gov/articles/PMC8780700/) and [alternative computer access following stroke](https://pubmed.ncbi.nlm.nih.gov/26427744/) supports exploring head control as another input method, though these studies do not validate Glimra itself. Even changing a presentation page may require physical interaction that is difficult for some users. Teachers, public speakers, trainers, and workshop facilitators can also be interrupted when they need to reach for presentation controls.

**Glimra explores a more accessible, hands-free way to present.** Built with the Presage SmartSpectra SDK, the desktop app lets presenters navigate local PDFs with deliberate head movements: a gentle turn changes pages and a nod scrolls when content is scrollable. Keyboard navigation remains available. The current Head mode has real-camera evidence; optional eye-blink controls still need live hardware verification.

The goal is simple: **make presenting easier, more independent, and more accessible.**

For the underlying sources, project diagnostics, and limitations, read [Research & Validation](docs/RESEARCH_AND_VALIDATION.md).

## Install Glimra

These ZIPs come from the [official GitHub Actions build](https://github.com/0xaje/Glimra/actions/runs/43540677030). Sign in to GitHub to download them.

| Platform | Install |
| --- | --- |
| Windows x64 | Extract the ZIP and run the included installer. The installer is unsigned, so Windows may display an unknown-publisher warning. |
| Ubuntu x64 (22.04+) | Extract the ZIP, mark the AppImage executable, then open it. Packaged camera operation on Ubuntu still needs live verification. |

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


## Research and validation

Glimra is motivated by accessibility needs and by published work on hands-free computer interaction. The supporting figures, papers, Presage SDK references, and actual November 9 live diagnostic evidence are documented in [Research & Validation](docs/RESEARCH_AND_VALIDATION.md). These sources do **not** establish a Glimra user-market size or a gesture accuracy rate. Head mode has real-device evidence; optional Eyes mode still needs genuine hardware acceptance.

See the [November 20 lighting observations and paired screenshots](docs/LIGHTING_TEST_2026-11-20.md) for additional presenter testing and its limitations.

## Camera consent and data handling

Camera capture starts after you explicitly enable camera control. **Disconnect camera** stops the capture session. **Pause** stops gesture commands while leaving capture active. Glimra processes camera frames locally through the native SDK and does not record or upload footage or facial landmarks. Derived gesture signals are held in memory, and PDFs are rendered locally.

The app disables SDK telemetry in its configuration. Presage authentication and metering may still require network access. If you save your API key, Glimra uses Electron's OS-backed secure storage where supported. See the [full privacy disclosure](docs/PRIVACY.md).

## Current scope and roadmap

The current build covers local PDF presentation, camera consent, Head mode, and keyboard navigation. The Windows demo shows Head mode in use. Eyes mode and the packaged Ubuntu camera flow still need live verification.

Next steps are to test camera distance and lighting in classroom setups, verify presenter handoff, and run hardware checks for Ubuntu and Eyes mode. See the [project website](https://glimra-studio.flutteringpeach8.chatgpt.site/#roadmap) for longer-term ideas.

## Development checks

```bash
npm run build
npm test
npm run lint:hallmark
```

Built for the [Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04). Released under the [MIT License](LICENSE).
