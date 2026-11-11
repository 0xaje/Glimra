# Glimra — current test evidence

Updated November 9, 2026. This document replaces the obsolete renderer-based and legacy blink-engine test claims.

## Real hardware evidence

On the presenter's Windows computer, the official Presage SmartSpectra native SDK diagnostic observed: 487 decoded metrics packets, 416 stable 478-point facial-landmark packets, 566 valid quality checks, zero low-FPS warnings and no SDK errors. The real face-centroid range was 0.539 horizontal and 0.266 vertical face widths. The user subsequently reported that the native-powered Head mode worked and improved substantially, but still needed polish and a second-presenter handoff.

Eyes mode has **not** passed live acceptance: that standalone diagnostic reported zero detected blink starts.

## Automated evidence

The active CI compiles the React/Electron TypeScript source, builds PDF frontend assets, runs the Hallmark app design linter, then runs the Node automated tests. The legacy browser-only `GestureEngine` tests were removed because they did not test the actual native blink pipeline. `tests/presageHeadMotion.test.mjs` now covers mathematical movement interpretation, frame timestamps, handoff and rearm behavior; the tests do **not** produce fake signals at runtime.

The new Windows CI job builds and uploads an unsigned NSIS installer without releasing it to GitHub. The Linux AppImage build is verified separately. A package compiling successfully does not prove that a clean Windows machine can load the native SDK or run its physical webcam.

Use `npm ci && npm run build && npm run lint:hallmark && npm test` and check the latest GitHub Actions run on the repository's main branch for exact results. See [release checklist](RELEASE_CHECKLIST.md).

## Still unverified

- Continuous 5+ minute real-camera in-app presentation with gestures and stable SDK metrics.
- Repeatable head gestures and scroll on a clean Windows installation.
- The new presenter handoff under varying lighting and camera placement.
- Optional Eyes mode under genuine detected blinks.
- App process shutdown, camera release and key persistence on a clean target computer.
- Compatibility and runtime behavior of unsigned Windows installer on a non-developer PC.

Do not describe any unverified item as passed in the DEV challenge submission.
