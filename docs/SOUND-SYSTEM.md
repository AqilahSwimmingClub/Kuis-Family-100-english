# FAMILY 100 game show sound

Both the React application and `/game-center/` load the same small classic script at `/audio/game-show-audio.js`. Effects are synthesized locally with Web Audio; no recordings, remote audio assets, or new dependencies are used.

## Teacher controls

Open **Pengaturan Suara** from the homepage or either game mode. Defaults are effects enabled, master volume 65%, and **Game Show**. **Normal** uses simpler arrangements. The volume slider covers 0–100%; **Tes Suara** plays a representative correct-answer scene. Browser and device output volume must also be audible.

The **Galeri Efek Suara** in the same menu lists all 17 effects by their classroom use. Press **Putar** beside an effect to hear that effect individually, using the selected profile and master volume. The existing **Tes Suara**, mute switch, slider and profile selector remain available. Preview controls are disabled while effects are muted or volume is zero; they never unmute the device automatically.

Selecting another preview stops the previous scene, including a long winner fanfare before a short countdown tick or button click. If the browser is still resuming audio, only the latest preview request may start. Previewing does not dispatch game actions, reveal answers, award points, advance questions or alter saved progress. The modal scrolls on smaller screens, and each Putar control has an accessible effect-specific name and a touch target of at least 44 pixels.

Settings persist in `family100.audio.v1` and synchronize through browser storage events. An existing English Challenge mute is adopted once when the new settings key is absent. Explicit new settings take precedence. Game snapshots, imports and scoring rules are unchanged; the center round additionally stores optional `audioStealResolved` presentation metadata so a pending or resolved steal retains the correct sound after resume/import. Legacy saves without that field conservatively avoid replaying a steal victory.

## Event routing

| Gallery label | Cue ID | English Challenge automatic event | Game Center automatic event |
| --- | --- | --- | --- |
| Intro aplikasi | `intro` | First trusted pointer/Enter/Space interaction | Same |
| Mulai permainan | `opening` | Start a validated new game | Same |
| Soal berikutnya | `question` | Navigate to a different question | Advance to the next question |
| Jawaban benar | `correct` | Reducer accepts a newly credited answer | Valid typed answer or teacher awards an unopened answer |
| Jawaban salah | `wrong` | Teacher presses WRONG | Teacher presses Catat Belum Tepat |
| Buka jawaban | `reveal` | SHOW ALL reveals answers without points | Teacher opens Buka Jawaban Manual |
| Tambah poin | `score` | Coins within credited-answer scenes; positive manual score correction | Coins within credited-answer scenes |
| Bonus / poin tinggi | `celebration` | Flourish within an accepted answer worth at least 30 points | Same |
| Final Steal dimulai | `steal` | Reducer accepts STEAL after three wrong answers | Teacher starts an unused Final Steal |
| Final Steal berhasil | `steal-success` | Accepted answer during the steal phase | First credited answer during a pending Final Steal |
| Final Steal gagal | `steal-fail` | Teacher presses WRONG during the steal phase | Teacher records wrong during a pending Final Steal |
| Countdown 5 detik | `countdown` | Existing timer reaches 5, 4, 3, 2 and 1 seconds | Preview available; this mode has no timer |
| Waktu habis | `timeout` | Existing timer reaches zero | Preview available; this mode has no timer |
| Pergantian giliran | `turn` | Teacher changes the point recipient | Teacher changes Tim menjawab |
| Pembahasan | `discussion` | Preview available; reflection appears inline without a discussion button | Teacher opens Pembahasan |
| Pengumuman pemenang | `winner` | Newly finished game | Same |
| Tombol biasa | `click` | Ordinary enabled buttons when no explicit cue was issued | Same |

A correct answer is a single composite audio scene: reveal/ding, score coins when points are credited, and a celebration for an answer worth at least 30 points. The steal-success scene uses its own victory arrangement with the same point layers. Both profiles retain these event layers; Normal simplifies their instrumentation. These layers are scheduled together rather than issuing competing play calls. The gallery also exposes score coins and celebration separately. Audio never awards points.

React emits cues after the existing reducer accepts an action. The standalone center emits them only after its existing validation and scoring guards. Unmatched typed answers do not trigger a wrong buzzer. Rejected or duplicate actions, rerenders, settings changes and restored final results do not repeat gameplay cues. A semantic cue from the first interaction can replace the intro; an ordinary click or countdown tick does not interrupt an active primary gameplay fanfare.

The existing English timer drives countdown audio. The standalone Game Center has no timer; this task does not add a timer or change its rules. Starting a game uses its full opening arrangement rather than immediately cutting it off with another question cue.

## Browser lifecycle and output

No AudioContext is created on page load. Trusted interaction unlocks it; pending resumes are awaited and invalidated after mute/stop. Suspended/interrupted contexts can recover, while a closed context is recreated only on a new interaction. The shared script installs listeners once, including under React StrictMode.

Scenes use musical intervals, filtered synthesized noise, short attack/release envelopes, master gain and a dynamics compressor. A bounded voice pool and event-ID set prevent resource growth. New gameplay cues fade previous scenes; low-priority clicks/ticks do not interrupt a primary fanfare. Muting, zero volume, hidden documents and page exit stop active and scheduled sources. Interrupted sources disconnect immediately so old tails cannot resume later.

Animations respect reduced motion. Sound remains independently configurable; enabling reduced motion does not mute audio.

## Verification scope

Use `npm run build` and `npm run preview` to validate both entry points together. For direct static-page development under Vite dev, use `/game-center/index.html`; the production-style preview serves `/game-center/`.

The audit checks all 17 recipes rather than counting labels: oscillator waveform, frequency automation, noise, envelopes and note timing produce 17 distinct source plans in each profile. Shared metadata gives both menus the same label-to-ID mapping. Short chimes deliberately share musical building blocks with longer scenes while retaining different pitches, rhythms or arrangements.

Unit tests exercise event routing through the real scoring reducer, including accepted point values and silent rejected actions, and simulate low-level browser failures, resume races, cleanup, preference migration and de-duplication. Gallery tests check every named preview, distinct sound plans, profile selection, mute/zero volume and cancellation of stale previews. Browser tests delegate to native Web Audio nodes and measure real PCM after master gain: nonzero output, safe peaks, volume response, mute/zero silence, suspend recovery and all 17 cues. These tests also exercise the teacher controls and gameplay in both modes.

Cloud Chromium, mobile emulation and large-screen viewport checks do not establish physical speaker output on Android, tablets or PID Hisense, or separate Chrome/Edge installations. Those physical/browser checks remain a manual validation limit; use **Galeri Efek Suara → Putar** to check each effect on the actual display and speakers.

Run `npm run lint`, `npm test`, `node scripts/verify-game-center.mjs`, `npm run build`, and `npm run test:e2e` for the current revision. Production deployment and GitHub Actions are verified separately during integration.
