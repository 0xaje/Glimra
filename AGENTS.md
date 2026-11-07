# AGENTS.md — Instructions for Autonomous & Coding Agents

This repository is **Glimra** ("Control without a touch"), a real, production-grade desktop presentation application powered by intentional eye gesture detection using the Presage SmartSpectra SDK.

Every coding agent working on this codebase must strictly observe the following rules:

---

## 1. Operating Procedure

1. **Read `docs/MASTER_PLAN.md` completely** before making changes or proposing architecture.
2. **Read `docs/PROGRESS.md`** to know the current milestone, what has been verified, and the `RESUME HERE` pointer.
3. **Follow the next unfinished milestone.** Do not skip ahead or implement decorative features before prerequisites pass their stop gates.
4. **Preserve existing working functionality.** Never refactor or delete working code without an explicit reason recorded in `docs/DECISIONS.md`.
5. **Update documentation immediately** after meaningful changes (`docs/PROGRESS.md`, `docs/TEST_REPORT.md`, `docs/SDK_VERIFICATION.md`).
6. **Commit and push verified work.** Every milestone commit must include real verification evidence.
7. **Report blockers honestly.** If a hardware device, API, or permission cannot be accessed or verified, record it as a blocker with complete diagnosis. Never fake completion.

---

## 2. Non-Negotiable Engineering Rules

1. **No fake activities or simulated camera measurements presented as genuine.**
2. **No mock physiological or gesture data presented as real.** Automated tests may use test doubles only when clearly identified as tests, but test doubles never replace hardware verification.
3. **No fabricated SDK responses or fake slide-control success.**
4. **No hardcoded user-specific configuration masquerading as public functionality.**
5. **No secret API keys in the repository, commit history, or packaged client.** Never commit `.env` or hardcode credentials into renderer/main bundles.
6. **No unnecessary paid dependencies.** If a tool creates ongoing costs, obtain explicit approval before integration.
7. **No medical, diagnostic, or unsupported emotional claims.**
8. **No feature marked `VERIFIED` without verifiable evidence.**

---

## 3. Design Standards (Hallmark)

- Use the **Hallmark design skill** located at `.agents/skills/hallmark/` for all UI and frontend work.
- Adhere strictly to the **Floor** rules in `docs/DESIGN_SYSTEM.md` and Hallmark:
  - Every color and font must go through declared tokens (`:root`).
  - No purple-to-blue gradients, no nested cards inside cards, no floating glowing shapes.
  - No decorative status dots, fake analytics feeds, or empty metric cards.
  - Clear visual hierarchy, accessible contrast (WCAG AA minimum), instant `:focus-visible`, and `prefers-reduced-motion` compliance.
  - Test UI files with `node .agents/skills/hallmark/scripts/sloplint.mjs <file>`.

---

## 4. GitHub Workflow

1. Always verify the current branch and diff with `git status` and `git diff`.
2. Run test suites and linting before staging changes.
3. Inspect staged files to ensure no secrets, keys, or temporary files are tracked.
4. Commit with descriptive semantic messages (`feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`).
5. Push to `origin main` and confirm the remote contains the commit. Report the actual commit SHA.
