# Verification — 15 October 2026

Validated in the cloud checkout using Node 24.19.0 and npm 11.9.0.

- `npm ci --no-audit --no-fund`: reproducible locked install succeeded.
- `npm run lint`: exit 0, no ESLint errors or warnings.
- `npm test`: 23 tests passed across three files.
- `npm run build`: TypeScript and Vite production build succeeded.
- `npm run test:e2e`: ten tests passed on Chromium, desktop 1440×900 and mobile 390×664. These tests run against production output served by Vite preview.
- Saved startup command `npm run dev -- --port 5173` started successfully. Internal requests to `/` and `/src/main.tsx` returned HTTP 200 with expected application content.

Browser coverage includes automatic scores, three strikes, one-attempt steal, non-scoring show-all after steal, undo, round reset, reload/continue, persistent question edits, malformed import rejection, all 30 rounds with six turns per team, shared ranks, reflection, responsive five-team scoreboard, projector controls and play with network disabled after asset load.

Unit coverage includes bank structure and totals, no double scoring, manual corrections, preservation of other rounds on reset, timer expiry, pause, navigation/interval cleanup, imported phase/strike and credit consistency, history validation, recovery from corrupted primary storage, CSV escaping and full-game JSON export/reimport. Full scoring gives each of five teams 600 points when every answer is opened normally in all six rounds.

An independent read-only review identified oversized undo snapshots, show-all being blocked after steal and inconsistent imported phase/strike state. Regression tests reproduced the failures; all three were corrected. Undo now stores compact history without duplicating immutable questions, retains at most 30 actions and bounds history size. A fourth regression ensures sound toggling does not reset the timer.

Build emits two upstream Zod comment-annotation notices; Rollup removes those comments and produces a successful bundle. npm reports upstream package deprecation notices for ESLint 9 and whatwg-encoding. These are dependency notices, not failed application checks. No TLS, signature or checksum verification was disabled. Playwright's browser download destination was denied by network policy; the existing system Chromium was used successfully without changing network policy.

No Vercel deployment or fresh-task environment snapshot restoration has been performed. The checked-in `vercel.json` sets the Vite build and `dist` output. No runtime secrets are required. The reusable cloud install script and startup instructions were saved as a draft; publication remains a separate user action in environment settings.
