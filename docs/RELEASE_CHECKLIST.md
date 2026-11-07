# RELEASE_CHECKLIST.md — Pre-Distribution Verification Checklist

Before publishing any release or submission build of Glimra:

---

## 1. Security & Credentials
- [ ] No `.env` or development credentials committed in Git.
- [ ] No API keys baked into `dist/` or renderer bundle files.
- [ ] API keys stored only via secure local mechanism (`safeStorage`).
- [ ] All third-party notices and licenses accounted for.

---

## 2. Hardware & SDK Verification
- [ ] Camera stream activates only after explicit user consent.
- [ ] Camera indicator light shuts off promptly when presentation is stopped.
- [ ] SmartSpectra native libraries loaded cleanly from `resources/smartspectra` in packaged builds.
- [ ] Graceful fallback when camera is unavailable or permission denied.

---

## 3. Presentation Engine
- [ ] PDF file import works smoothly for decks up to 100+ slides.
- [ ] Aspect ratio preserved without distortion or letterbox artifacts.
- [ ] Keyboard navigation (`Left`, `Right`, `Space`, `Esc`, `F`) responsive under 50ms.
- [ ] Fullscreen toggle works cleanly without window flicker.

---

## 4. Hallmark Design & Accessibility
- [ ] All colors and fonts routed through `:root` design tokens.
- [ ] Clean run of `node .agents/skills/hallmark/scripts/sloplint.mjs src/`.
- [ ] Instant `:focus-visible` outlines on all interactive controls.
- [ ] `prefers-reduced-motion` fallbacks honored.
- [ ] WCAG AA contrast ratio compliance verified.

---

## 5. Clean Environment Install
- [ ] Application builds and installs on a fresh machine without Node or dev tools.
- [ ] Packaging targets validated for target OS (`AppImage` on Linux, NSIS on Windows, dmg on macOS).
