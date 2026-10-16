# Sound Effect Gallery Implementation Plan

> **For agentic workers:** Use test-first implementation and independent review. Execution is already authorized by the user's request to complete and deploy the fix.

**Goal:** Let teachers preview all 17 existing effects individually from both sound settings menus.

**Architecture:** The shared Web Audio engine owns the effect catalog and interruptible preview API. React and the standalone Game Center render that catalog, preserving existing settings and gameplay routing.

**Tech Stack:** TypeScript, React, classic JavaScript, Web Audio, Vitest, Playwright.

**Spec:** User request “PERBAIKI MENU PENGATURAN SUARA FAMILY 100”, 16 October 2026.

## Global Constraints

- Keep the white homepage, 7 subjects, 49 chapters, and 1,091 questions unchanged.
- Do not change score rules, question banks, dependencies, or Android/APK work.
- Preserve sound enablement, volume, Normal/Game Show profiles, and Tes Suara.
- Preview must stop the preceding effect and respect mute, zero volume, and browser activation.
- Commit, push, open a PR, merge only after green CI, and verify the existing Vercel deployment.

## Review Focus

- Rapid previews while AudioContext is suspended must play only the latest request.
- Short click/countdown previews must interrupt a long fanfare.
- Muting or lowering volume to zero must stop active sound and disable preview controls.
- Every label must map to its own sound, including after selecting another profile.
- All controls must remain reachable on small screens, touch displays, and with a keyboard.

### Task 1: Shared catalog and preview

**Files:** `public/audio/game-show-audio.js`, `src/game/audio.ts`, audio engine tests and test utilities.

**Interfaces:** `getEffects(): {id, label, description}[]`, `preview(name): Promise<boolean>`; React wrappers `getSoundEffects()` and `previewSound(name)`.

- [x] Write and run failing catalog, preview interruption, pending-resume, mute, and uniqueness tests.
- [x] Implement one catalog for all 17 effects and a generation-safe preview path.
- [x] Audit distinct synthesis in both profiles and automatic score/celebration layers.
- [x] Run engine tests until they pass.

### Task 2: Settings galleries

**Files:** `src/components/SoundSettings.tsx`, `src/components/sound-settings.css`, `public/game-center/index.html`, component tests and gallery E2E tests.

- [x] Reproduce the missing gallery with a failing test.
- [x] Render 17 named effects under “Galeri Efek Suara”, each with a Putar button.
- [x] Use the shared preview API, preserve settings, and announce playback results accessibly.
- [x] Verify exact mappings, replacement of earlier previews, mute/zero, keyboard access, touch targets, and responsive overflow.

### Task 3: Verification and delivery

**Files:** `docs/SOUND-SYSTEM.md`; no protected gameplay files.

- [x] Review all gameplay mappings and document the existing event/composite relationships.
- [x] Run lint, the entire unit suite, bank validation, build, and the entire E2E suite.
- [x] Independently review the diff and verify protected files have no changes.
- [ ] Commit, push, create PR, wait for green checks, and merge the reviewed head.
- [ ] Verify main CI, the existing Vercel deployment, and live gallery audio in a browser.

Local verification: lint, 79 unit tests, bank validation, production build, and 140 desktop/mobile E2E tests passed. Independent review found no blockers. Physical Android/tablet/PID Hisense speaker checks were unavailable.
