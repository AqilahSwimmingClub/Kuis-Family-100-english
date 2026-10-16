# FAMILY 100 game show sound

Both the React application and `/game-center/` load the same small classic script at `/audio/game-show-audio.js`. Effects are synthesized locally with Web Audio; no recordings, remote audio assets, or new dependencies are used.

## Teacher controls

Open **Pengaturan Suara** from the homepage or either game mode. Defaults are effects enabled, master volume 65%, and **Game Show**. **Normal** uses simpler arrangements. The volume slider covers 0–100%; **Tes Suara** plays a representative correct-answer scene. Browser and device output volume must also be audible.

Settings persist in `family100.audio.v1` and synchronize through browser storage events. An existing English Challenge mute is adopted once when the new settings key is absent. Explicit new settings take precedence. Game snapshots, imports and scoring rules are unchanged; the center round additionally stores optional `audioStealResolved` presentation metadata so a pending or resolved steal retains the correct sound after resume/import. Legacy saves without that field conservatively avoid replaying a steal victory.

## Event routing

| Event | Cue |
| --- | --- |
| First trusted pointer/Enter/Space interaction | Short intro |
| New game | Opening fanfare |
| Actual question navigation | Digital whoosh and turn chime |
| Newly credited answer | Reveal, bright ding and score coins |
| High-point answer | Additional celebration in Game Show |
| Teacher marks wrong | Buzzer |
| Non-scoring reveal | Reveal chime |
| Positive manual score adjustment | Score coins |
| Steal starts / succeeds / fails | Suspense / victory / dramatic fail |
| Last five timer seconds / expiry | Tick / time-up |
| Teacher changes answering team | Turn chime |
| Teacher opens discussion | Soft notification |
| Newly finished game | Grand fanfare and lightweight confetti |
| Ordinary enabled buttons | Soft click when no explicit cue was issued |

A correct answer is a single composite audio scene; audio never awards points. React emits cues after the existing reducer accepts an action. The standalone center emits them only after its existing validation and scoring guards. Unmatched typed answers do not trigger a wrong buzzer. Repeated reveals, rerenders, settings changes and restored final results do not repeat gameplay cues.

The existing English timer drives countdown audio. The standalone Game Center has no timer; this task does not add a timer or change its rules. Starting a game uses its full opening arrangement rather than immediately cutting it off with another question cue.

## Browser lifecycle and output

No AudioContext is created on page load. Trusted interaction unlocks it; pending resumes are awaited and invalidated after mute/stop. Suspended/interrupted contexts can recover, while a closed context is recreated only on a new interaction. The shared script installs listeners once, including under React StrictMode.

Scenes use musical intervals, filtered synthesized noise, short attack/release envelopes, master gain and a dynamics compressor. A bounded voice pool and event-ID set prevent resource growth. New gameplay cues fade previous scenes; low-priority clicks/ticks do not interrupt a primary fanfare. Muting, zero volume, hidden documents and page exit stop active and scheduled sources. Interrupted sources disconnect immediately so old tails cannot resume later.

Animations respect reduced motion. Sound remains independently configurable; enabling reduced motion does not mute audio.

## Verification scope

Use `npm run build` and `npm run preview` to validate both entry points together. For direct static-page development under Vite dev, use `/game-center/index.html`; the production-style preview serves `/game-center/`.

Unit tests exercise event routing through the real scoring reducer and simulate low-level browser failures, resume races, cleanup, preference migration and de-duplication. Browser tests delegate to native Web Audio nodes and measure real PCM after master gain: nonzero output, safe peaks, volume response, mute/zero silence, suspend recovery and all 17 cues. These tests also exercise the teacher controls and gameplay in both modes.

Cloud Chromium and mobile emulation do not establish physical speaker output on Android/tablets or separate Chrome/Edge installations. Those physical/browser checks remain a manual validation limit; the application provides Tes Suara for this purpose.

Local verification on 16 October 2026: `npm run lint`, 61 tests in `npm test`, `node scripts/verify-game-center.mjs`, `npm run build`, and all 126 desktop/mobile `npm run test:e2e` checks passed. Targeted independent review also verified the legacy mute, nested-dialog focus, and persisted steal metadata regressions. Production deployment and GitHub Actions are verified separately during integration.
