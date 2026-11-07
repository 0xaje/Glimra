/* hallmark: Darkroom (amber), floor adhered, zero-slop presentation design system */
# DESIGN_SYSTEM.md — Glimra Visual Identity & Design Tokens

Glimra's design adheres to the **Hallmark Design Skill** (`.agents/skills/hallmark`), specifically the **Darkroom** atmospheric theme.

The application presents itself like a photographic contact room or darkroom lab: warm print-black surfaces, fibre-white ink, hairline condensed capitals over crisp Barlow body type, and a single amber safelight signal for active states and feedback.

---

## 1. The Hallmark Floor Adherence

Every UI component in Glimra strictly conforms to Hallmark's non-waivable Floor:
1. **Token discipline:** Every color and font is declared as a CSS variable at `:root`. No ad-hoc literal colors or font overrides.
2. **Restrained transitions:** Never `transition: all`. Transitions only apply to specific properties (`color`, `background-color`, `opacity`, `transform`) under `--dur-fast` (120ms) or `--dur-base` (200ms).
3. **Typography integrity:** No italicized words inside roman headings. No tracked-capital labels, no small caps. Labels, captions, and tags use the body face in sentence case without artificial tracking.
4. **Layout stability:** `overflow-x: clip` on `html` and `body`. Never `overflow: hidden` or `width: 100vw`.
5. **Accessibility:**
   - Instant `:focus-visible` outlines on every interactive element using `--color-focus`.
   - Full `prefers-reduced-motion: reduce` fallbacks.
   - Contrast ratios surpass WCAG AA standards (minimum 4.5:1 for body text, 3:1 for large display elements).
6. **No AI slop:** Zero purple-to-blue gradients, zero floating glowing card borders, zero nested cards inside cards, zero fake analytics counters.

---

## 2. Design Tokens

```css
:root {
  /* Surfaces & Grounds */
  --color-paper: oklch(12.5% 0.008 55);       /* #171615 - Warm print-black ground */
  --color-paper-2: oklch(16% 0.009 55);       /* #21201e - Subtle surface / card */
  --color-paper-3: oklch(20.5% 0.01 55);      /* #2b2a28 - Elevated panel */
  
  /* Typography Colors */
  --color-ink: oklch(92% 0.012 78);           /* #ebe7df - Fibre-white primary text */
  --color-ink-2: oklch(80% 0.012 75);         /* #c9c5bd - Secondary text */
  --color-muted: oklch(64% 0.012 65);         /* #9b9891 - Captions & metadata */
  
  /* Structural Lines */
  --color-rule: oklch(29% 0.01 55);           /* #3e3d3b - 1px structural hair rules */
  
  /* Safelight Amber Signal */
  --color-accent: oklch(73% 0.15 58);         /* Amber safelight indicator / active */
  --color-accent-deep: oklch(50% 0.11 52);    /* Darker amber for quiet emphasis */
  --color-accent-ink: oklch(12.5% 0.008 55);  /* Text on amber background */
  --color-focus: oklch(73% 0.15 58);          /* Unbroken focus outline */
  
  /* Status Signals */
  --color-error: oklch(62% 0.19 32);          /* Muted darkroom red */
  --color-success: oklch(70% 0.14 140);       /* Subdued forest signal */

  /* Typography */
  --font-display: "Sofia Sans Extra Condensed", ui-sans-serif, sans-serif;
  --font-body: "Barlow", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* Metric Spacing & Rules */
  --rule-hair: 1px;
  --radius-card: 0px;
  --radius-pill: 0px;
  --shadow-card: none;
  --tracking-display: -0.005em;
  --display-weight: 200;
  --grain: 0.05;

  /* Spacing Scale (8pt grid) */
  --space-2xs: 4px;
  --space-xs: 8px;
  --space-sm: 12px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;

  /* Transitions */
  --dur-fast: 120ms;
  --dur-base: 200ms;
  --dur-long: 400ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
}
```

---

## 3. Component Patterns

### Buttons & Controls
- **Primary Action (Safelight Fill):**
  - Background: `var(--color-accent)`
  - Text: `var(--color-accent-ink)`
  - Border: 1px solid `var(--color-accent)`
  - Border-radius: 0
  - Height: 44px minimum touch/pointer target
- **Secondary Action (Hairline Ink Outline):**
  - Background: transparent
  - Text: `var(--color-ink)`
  - Border: 1px solid `var(--color-ink-2)`
  - Border-radius: 0
- **Ghost Action:**
  - Background: transparent
  - Text: `var(--color-muted)`
  - Hover: `var(--color-ink)` with subtle bottom underline

### Presentation Canvas
- Slide viewport centered with true aspect-ratio preservation (16:9 or 4:3).
- Deep borderless dark surround (`--color-paper`) that fades visual clutter during active presentation.

### Safelight Gesture HUD
- An ultra-minimal status badge positioned in the top-right corner.
- When an eye gesture is held, an amber hairline ring or progress line fills smoothly.
- Once triggered, a single quiet amber flash occurs, immediately advancing the slide.
- In pause mode, the badge indicates `PAUSED` in `--color-muted`.

---

## 4. Verification with Sloplint

Before any release or frontend PR, all styling is checked via:
```bash
node .agents/skills/hallmark/scripts/sloplint.mjs src/ --scope app
```
All Floor violations must be zero.
