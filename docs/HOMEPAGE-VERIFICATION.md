# Homepage redesign verification — 16 October 2026

The root page now presents FAMILY 100 Educational Game Center with a white, navy, blue, and gold theme. Seven SVG subject tiles animate with reduced-motion support; subject cards select the corresponding Game Center bank. The original English Challenge is retained at `/?mode=english`, including its storage keys and gameplay.

## Executed checks

- Clean locked installation: `npm ci` passed (292 packages, Node 24.19.0 / npm 11.9.0).
- `npm run lint`: passed, no warnings.
- `npm test`: 27 tests passed across five files after the keyboard-focus fix.
- `node scripts/verify-game-center.mjs`: passed; 1,091 unique question IDs, seven subjects, 49 subject/chapter pairs and existing Family 100 score totals validated.
- `npm run build`: passed; the Playwright rerun also rebuilt the final application.
- `npm run test:e2e`: 80 desktop/mobile tests passed, including all original English and Game Center tests.
- After the final Escape-focus fix, `npm run test:e2e -- e2e/homepage.spec.ts`: all 20 homepage tests passed, including keyboard focus restoration on mobile.
- `git diff --exit-code -- public/game-center/data package.json package-lock.json`: passed; source questions, dependency declarations and lockfile unchanged.
- Independent code review identified the Escape-focus issue; its regression failed before the fix and passed afterward. Targeted rereview found no remaining blocker.

Responsive browser checks cover 360×720, 393×873, 768×1024, 1024×768, 1200×800 (representative 11.2-inch tablet CSS viewport), 1366×768 and 1920×1080. Checks verify no horizontal overflow, title bounds, minimum 44px visible link/button heights, subject navigation, real question selection, reduced motion, and desktop/mobile screenshots. A physical tablet's exact CSS viewport varies with resolution and scaling; these checks use Chromium emulation.

New integration coverage includes saved/completed game resume, safe fallback for malformed or missing local data without deleting it, question-browser search/filter/pagination, and all seven subject links. The homepage catalog is derived at Vite configuration time from the same eight source bank files, shipping only summary counts in the homepage bundle. English Challenge is loaded separately.

## Existing behavior preserved

Game Center still relies on teacher selection of the answering team; its opportunity counters do not guarantee automatic rotation. Final Steal selects the lowest-scoring team in the current round and allows one activation per question; existing scoring behavior was left intact. Homepage copy describes these actual capabilities rather than promising a new automatic rotation engine.

The bank remains editorial candidate v1.5 with the existing teacher-review notice. This redesign does not alter question content or independently verify textbook correctness.

Build output contains the existing upstream Zod annotation notices. npm reports upstream ESLint 9 and whatwg-encoding deprecation notices; all checks completed successfully, with TLS and package integrity verification retained.

GitHub Actions and the connected Vercel deployment are checked separately during PR integration; local checks alone do not prove publication.
