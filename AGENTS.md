# AGENTS.md — Instructions for Autonomous & Coding Agents

This repository is **Glimra** ("Control without a touch"), a real desktop PDF presentation application powered by live **Presage SmartSpectra facial landmarks** for gentle head navigation, with optional (not yet hardware-verified) SmartSpectra blink controls. No MediaPipe or alternate human-sensing engine is active.

**Official repository:** https://github.com/0xaje/Glimra  
**Branch:** `main`

Every coding agent working on this codebase must strictly observe the following permanent rules:

---

## 1. GitHub is our Source of Truth

All verified development work must be committed and pushed to the official GitHub repository (`origin main`).

**Never leave completed work only on the local machine.**

After every meaningful, verified milestone:
1. **Review code changes:** Run `git status`, `git diff --check`, and inspect modified files.
2. **Run relevant tests:** Run unit tests (`npm test`), build check (`npm run build`), and Hallmark floor audit (`npm run lint:hallmark`).
3. **Inspect for defects and credentials:** Check for runtime errors, broken functionality, and strictly verify zero exposed secrets or `.env` files.
4. **Update `docs/PROGRESS.md`:** Record implemented work, actual test evidence, commit hash, and GitHub push status.
5. **Commit changes:** Stage only reviewed files and write a meaningful semantic commit message (`feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`).
6. **Push to GitHub:** Push to `origin main` using `git push origin main`.
7. **Confirm push succeeded:** Run `git rev-parse HEAD` and `git rev-parse origin/main` to confirm the remote branch actually contains the commit.
8. **Report evidence:** Report the actual commit hash and the GitHub commit link (`https://github.com/0xaje/Glimra/commit/<SHA>`).

**Do not claim that anything was pushed without confirming it.**

---

## 2. Review Your Own Work Before Pushing

Before every commit, inspect:
- Code quality and architectural correctness.
- TypeScript compilation errors (`tsc --noEmit`).
- Bundler and build errors (`npm run build`).
- Security vulnerabilities and exposed credentials.
- Broken or incomplete functionality.
- Unnecessary dependencies or bloated packages.
- Unused code, dead branches, or dangling imports.
- Graceful error handling across all IPC and async paths.
- Accessibility standards (WCAG AA contrast, instant `:focus-visible`).
- Hallmark design floor compliance (no purple-blue gradients, no cards inside cards, no fake analytics).
- Real SmartSpectra integration without mocks pretending to be hardware.
- Compatibility with existing working features.

**Never replace real functionality with mock responses or simulated success.**  
If a feature cannot be tested because hardware or credentials are unavailable, clearly mark it **UNVERIFIED** or **BLOCKED**.  
**Never invent passing test results.**

---

## 3. Maintain the Progress Tracker (`docs/PROGRESS.md`)

After each milestone, update `docs/PROGRESS.md` with:
- Current milestone and status (`NOT STARTED`, `IN PROGRESS`, `BLOCKED`, `VERIFIED`).
- What was implemented.
- What was actually tested and how.
- Concrete test outputs and verification commands.
- Outstanding problems or blockers.
- List of files changed.
- Exact commit hash.
- Verified GitHub push status.
- Next development task.
- A functional **RESUME HERE** section so any new agent can pick up without guessing.

---

## 4. GitHub Workflow & Commands

Standard git procedure:
```bash
git status
git diff --check
git diff
git add <verified-files>
git commit -m "meaningful commit message"
git push origin main
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
```

- Stage only reviewed, intended files.
- Never commit `.env`, API keys, private credentials, or sensitive camera footage.
- Never force-push (`--force`), rewrite shared history, or delete existing work without explicit approval.
- If pushing fails, investigate the error and report the blocker immediately. Never claim a push succeeded when it failed.

---

## 5. Non-Negotiable Engineering Rules

1. **No fake activities or simulated camera measurements presented as genuine.**
2. **No mock physiological or gesture data presented as real.** Automated tests may use test doubles only when clearly identified as tests, but test doubles never replace hardware verification.
3. **No fabricated SDK responses or fake slide-control success.**
4. **No hardcoded user-specific configuration masquerading as public functionality.**
5. **No secret API keys in the repository, commit history, or packaged client.**
6. **No unnecessary paid dependencies.**
7. **No medical, diagnostic, or unsupported emotional claims.**
8. **No feature marked `VERIFIED` without verifiable evidence.**

---

## 6. Design Standards (Hallmark)

- Use the **Hallmark design skill** located at `.agents/skills/hallmark/` for all UI and frontend work.
- Adhere strictly to the **Floor** rules in `docs/DESIGN_SYSTEM.md` and Hallmark:
  - Every color and font must go through declared tokens (`:root`).
  - No purple-to-blue gradients, no nested cards inside cards, no floating glowing shapes.
  - No decorative status dots, fake analytics feeds, or empty metric cards.
  - Clear visual hierarchy, accessible contrast (WCAG AA minimum), instant `:focus-visible`, and `prefers-reduced-motion` compliance.
  - Test UI files with `node .agents/skills/hallmark/scripts/sloplint.mjs <file>`.

---

## 7. Operating Procedure

1. **Read `docs/PRESAGE_ONLY_IMPLEMENTATION.md`, `docs/ARCHITECTURE.md`, and `docs/RELEASE_CHECKLIST.md`** before changing sensing, IPC, camera security, or packaging.
2. **Read `docs/PROGRESS.md`** to know the current milestone, what has been verified, and the `RESUME HERE` pointer.
3. **Follow the next unfinished milestone.** Do not skip ahead or implement decorative features before prerequisites pass their stop gates.
4. **Preserve existing working functionality.** Never refactor or delete working code without an explicit reason recorded in `docs/DECISIONS.md`.
5. **Commit and push verified work.** Every milestone commit must include real verification evidence and confirmation from the remote repository.
6. **Report blockers honestly.** Never fake completion.
