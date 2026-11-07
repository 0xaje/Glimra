# DECISIONS.md — Architectural Decision Records (ADRs)

## ADR-001: Desktop Framework Selection (Electron + Vite + React + TypeScript)
- **Context:** We need a desktop presentation app with native camera access, high-performance canvas rendering (PDF slides), low-latency IPC, and official support for `@smartspectra/node-sdk`.
- **Decision:** Use Electron with Vite, React, and TypeScript.
- **Rationale:**
  - Presage officially ships `@smartspectra/node-sdk` tailored for Electron with built-in main, preload, and renderer packages.
  - React provides declarative UI state for presentation decks, HUD safelight indicators, and settings modals.
  - Vite ensures sub-second HMR and strict tree-shaking for desktop builds.
- **Alternatives Considered:**
  - Tauri: While lightweight, `@smartspectra/node-sdk` uses Koffi Node FFI and pre-packaged native bindings for Node.js, making Electron the tier-1 verified runtime for Presage.

---

## ADR-002: PDF as the First-Class Presentation Format
- **Context:** Users need to import and present slide decks reliably across all platforms.
- **Decision:** Use standard PDF format rendered via Mozilla's `pdfjs-dist`.
- **Rationale:**
  - Every presentation software (PowerPoint, Keynote, Google Slides, Canva) can export cleanly to PDF.
  - PDF guarantees pixel-perfect font rendering, vector sharpness, and slide fidelity without complex office suite dependencies.
  - Avoids brittle third-party PPTX parsers that fail on complex transitions or custom fonts.

---

## ADR-003: Hallmark Darkroom Theme for Visual Identity
- **Context:** Glimra must look like a crafted, authentic tool rather than generic AI slop.
- **Decision:** Adopt Hallmark's "Darkroom" theme.
- **Rationale:**
  - The Darkroom aesthetic (warm print-black ground, hairline Sofia Sans Extra Condensed, Barlow typography, amber safelight signal) perfectly mirrors the quiet, focused posture of a darkened presentation hall or lecture theater.
  - 100% adherence to Hallmark's mechanical Floor rules via `sloplint.mjs`.

---

## ADR-004: Intentional Dwell Time for Blink Recognition
- **Context:** Involuntary physiological blinks occur every few seconds. Accidental slide transitions would ruin a presentation.
- **Decision:** Require a sustained eye closure (dwell threshold: 400ms–700ms) followed by an intentional opening to trigger a slide transition.
- **Rationale:** Spontaneous human blinks last between 100ms and 250ms. A 400ms+ intentional pause clearly distinguishes deliberate control from natural reflex.
