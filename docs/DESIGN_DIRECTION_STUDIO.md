# DESIGN DIRECTION: GLIMRA PRESENTATION STUDIO

**Product:** Glimra ("Control without a touch")  
**Branch:** `feat/hallmark-redesign`  
**Standard:** Hallmark Design Skill (`.agents/skills/hallmark/SKILL.md`)  
**Theme:** Darkroom Presentation Studio  
**Target Viewports:** 1280×800 (Laptop / Desktop floor) & 1920×1080 (Auditorium / HD Display)

---

## 1. Visual Concept & Atmosphere

Glimra is not a SaaS dashboard, a marketing landing page, or a generic web utility. It is a **dedicated hands-free desktop presentation studio** designed for dark conference halls, lecture auditoriums, and live stages.

The visual direction draws inspiration from **broadcast television control rooms and darkroom contact stations**:
- Deep obsidian and charcoal grounds that disappear in low-light presenter environments.
- Crisp fiber-white typography and hairline mechanical boundaries that establish uncompromising optical precision.
- A single warm safelight amber signal accent (`oklch(0.76 0.16 65)`) for active triggers and focused states, completely rejecting the generic purple-to-blue SaaS aesthetic.
- Monospaced tabular numerals for slide counts, dwell timers, and telemetry metrics.
- High-contrast, WCAG AA compliant readability across all controls.

---

## 2. Spatial Layout & Architectural Systems

The studio operates in two fundamental modes: **Workspace Preparation** (First Launch / Deck Import) and **Live Presentation Studio** (Active Deck).

### Mode A: Workspace Preparation (First-Launch Experience)
Instead of a weak, floating centered box, the first-launch window is organized as a purposeful desktop studio workbench:
1. **Studio Header:**
   - Brand mark: "Glimra" with quiet architectural subtitle "Hands-Free Presentation Studio".
   - Status telemetry badge: Hands-Free Engine status (Inactive / Standby / Active).
   - Fast access actions: Setup Guide (`?`) and Settings (`S`).
2. **Main Workbench (Two-Column Asymmetric Layout):**
   - **Primary Deck Importer (Left / Prominent 60% Width):**
     - Large tactile dropzone designed with structural hairline borders and subtle inset depth.
     - Unmistakable primary CTA: "Import PDF Presentation".
     - Built-in secondary action: "Load Starter Presentation" for immediate hands-on evaluation.
     - Format and compatibility badges: PDF 1.4–2.0, standard 16:9 and 4:3 slide geometry.
     - Interactive drag-and-drop feedback states.
   - **Interaction Blueprint Stage (Right / 40% Width):**
     - An honest, physical interaction diagram explaining the intentional gaze model without jargon:
       - *Involuntary Blinks (< 300ms)*: Filtered by temporal threshold; slides remain steady.
       - *Intentional Dwell (380ms)*: Deliberate prolonged eye closure triggers slide advance.
       - *Double-Blink (< 450ms)*: Rhythmic double pulse steps backward to previous slide.
     - Keyboard fallback matrix: Instant reminder of arrow keys, `Space` / `P` to pause, `B` to blackout, and `F` for fullscreen.
3. **Studio Footer Dock:**
   - Security assurance note: "100% on-device processing via Presage SmartSpectra SDK. No camera imagery ever leaves this machine."
   - Electron local secure storage status for API credentials.

### Mode B: Live Presentation Studio (Loaded Deck)
When a deck is loaded, chrome steps back to let the speaker's content take center stage:
1. **Slide Canvas Stage:**
   - Edge-to-edge presentation framing with subtle hairline studio border.
   - Instant transition and high-resolution rendering powered by PDF.js.
   - Full blackout screen overlay (`B` / `.`) that instantly blacks out the display for speaker focus.
2. **Floating Studio HUD (Top Right):**
   - Compact broadcast telemetry capsule.
   - Tracking lock indicator, face framing confidence, and dwell charge progress bar.
   - Quick pause / resume button (`Space` or `P`).
   - Optional live camera preview window with zero decorative status dots.
3. **Presenter Dock (Bottom Floating Bar):**
   - Slide index in tabular monospace: `04 / 24`.
   - Discrete presentation timer (MM:SS) that starts upon deck load.
   - Physical navigation buttons: Previous (`←`), Next (`→`), Blackout (`B`), Fullscreen (`F`), and Eject deck.

---

## 3. Typography Hierarchy

All typography uses declared system font stacks tuned for high-DPI desktop rendering:
- **Display & Section Headings:**
  - Font: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif`
  - Weight: 600 (Semibold) for headers, 500 for cards
  - Letter spacing: `-0.015em` on display, normal on body
  - Case: Natural sentence case. No all-caps tracking, no decorative small-caps.
- **Tabular & Telemetry Numerals:**
  - Font: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
  - Features: `font-variant-numeric: tabular-nums`
  - Used for: Slide numbers (`01 / 18`), timers (`00:00`), dwell durations (`380ms`), and keyboard shortcuts (`[B]`, `[F]`).
- **Body & Copy:**
  - Font: Inherits body sans
  - Line height: 1.55 for body, 1.25 for headings
  - Strict wrapping discipline: `text-wrap: balance` on titles, `overflow-wrap: break-word` everywhere.

---

## 4. Color Palette & Design Tokens

Every single color, border, and spacing value originates from `:root` tokens. No raw hex or rgb literals are used in component styles.

```css
:root {
  /* Studio Grounds & Surfaces */
  --studio-bg: #090b0e;
  --studio-surface: #11141a;
  --studio-elevated: #181d26;
  --studio-subtle: #202632;
  --studio-overlay: rgba(9, 11, 14, 0.92);

  /* Hairline Structural Rules */
  --studio-rule: #262e3d;
  --studio-rule-light: #364155;
  --studio-rule-focus: #f59e0b;

  /* Typography Inks */
  --studio-ink-primary: #f2f5f9;
  --studio-ink-secondary: #9aa5b6;
  --studio-ink-muted: #647082;
  --studio-ink-inverse: #090b0e;

  /* Safelight Amber Accent (Primary Signal) */
  --studio-amber: #f59e0b;
  --studio-amber-hover: #d97706;
  --studio-amber-subtle: rgba(245, 158, 11, 0.12);
  --studio-amber-ink: #090b0e;

  /* Functional Status Indicators */
  --studio-signal-active: #10b981;
  --studio-signal-warning: #f59e0b;
  --studio-signal-alert: #ef4444;

  /* Focus & Accessibility */
  --studio-focus: 2px solid #f59e0b;
  --studio-focus-offset: 2px;

  /* Radii & Metrics */
  --studio-radius-sm: 4px;
  --studio-radius-md: 6px;
  --studio-radius-lg: 10px;
}
```

---

## 5. Modal & Overlay Architecture

Modals (Settings, Interaction Guide, Camera Permission Consent) share a unified studio architecture:
- Backed by high-density dark scrim (`rgba(9, 11, 14, 0.85)`).
- Centered studio chassis with 1px hairline border (`var(--studio-rule)`).
- High visual hierarchy: clear section titles, descriptive labels, and distinct primary/secondary action footers.
- Fully accessible keyboard navigation: ESC to close, instant focus-visible trap, accessible ARIA roles (`dialog`, `aria-labelledby`, `aria-modal="true"`).

---

## 6. Hallmark Floor Compliance Plan

1. **Token Discipline:** 100% of colors, borders, font families, and radii use CSS variables from `globals.css`.
2. **Zero Status Dots:** Remove floating colored dots in favor of semantic text badges ("Active", "Tracking Locked", "Standby").
3. **Zero AI Slop:** No purple-to-blue gradients, no glassmorphic glows, no cards inside cards, no fake animations.
4. **Instant Focus Visible:** Every button, input, select, and link gets `--studio-focus` with 2px offset.
5. **No Layout Overflow:** `overflow-x: clip` on `html` and `body`.
6. **No Mock Telemetry:** The interface renders genuine state from `SmartSpectraController` and `window.glimraDesktop`. If the camera is disconnected, it displays "Camera Standby", never fake biometric waves.
