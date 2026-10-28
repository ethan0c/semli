# Voice capture: say it, watch it land

Status: Phases 1 and 2 built Oct 21, 2026 (`apps/mobile/src/lib/voice.ts`, `components/Heard.tsx`, `packages/core/src/cues.ts`); device verification pending. Builds on the Add screen (`apps/mobile/src/components/AddScreen.tsx`, `Composer.tsx`, `Reading.tsx`) and the extraction endpoint (`apps/web/app/api/extract/route.ts`).

## 1. What it is, in one line

On Add, tap the mic, talk the way you'd text a friend, watch the words appear as you say them and the days and times firm up under them, then send. Semli reads the transcript exactly as it reads a typed message.

## 2. Decisions, and why

| Decision | Choice | Why |
|---|---|---|
| Recognition | Apple's on-device speech recognition through `expo-speech-recognition` 58.0.0 (matches SDK 58) | Live partial results, volume events, a config plugin for both permission strings. Audio never leaves the phone when the on-device model is present. Needs a development build, not Expo Go. |
| What goes to the server | The transcript, as the existing `kind: 'text'` input | No new API input, no audio upload, no server change, same quota and same review sheet. The extraction model already handles "clinical Tuesday 7–3, pharm exam next Friday". |
| Live "understanding" | A local cue parser in `packages/core`, not the model | The model runs once, on send. Calling it per utterance would cost a quota slot per sentence and lag a second behind the voice. The parser finds days, dates and times with rules, instantly, offline, and is unit-testable. |
| What the live rows claim | "Heard", never "Added" | The parser is a hint. The review sheet is still the only place anything is confirmed. Rows must not use the green "New" pill from the onboarding demo. |
| Network fallback | Allowed; on-device whenever the phone supports it | If the on-device model is missing, Apple recognises over its network. That is Apple's server, not ours; the privacy page must say so before release. Decided Oct 21, 2026. |
| Where the mic shows | Add only. Not the onboarding composer. | Onboarding should not add a permission prompt before the first result. Revisit with data. |
| Free or Plus | Same as text: counts toward the 3 free imports a month | Voice is an input, not a feature. Gating it would gate the free path's best moment. |
| Platforms | iOS, and the web planner where the browser has speech recognition (Chrome, Edge, Safari; hidden in Firefox). | Added to the web Oct 28, 2026 for 1.2: `lib/voice.web.ts`, the same hook on the browser's own recognizer. Chrome sends the audio to Google, Edge to Microsoft, Safari to Apple; the privacy page says so. The bars come from the microphone through an analyser, and the mic permission is asked before listening starts. |

## 3. The flow

1. **Idle.** The composer toolbar gains a mic button (the `mic` icon already exists) between the PDF button and Send. VoiceOver: "Speak what's coming up".
2. **First tap.** The system microphone and speech-recognition prompts, straight away. The tap is the intent; a priming sheet would be more friction than the prompt. Denied → the error line under the composer: "Semli can't hear you. Allow the microphone in Settings." with a Settings link. Never ask again on its own.
3. **Listening.** The mic button fills with ink and becomes the stop button ("Stop listening"). The text input shows the transcript live: committed words in primary ink, the current partial phrase in secondary ink, so the sentence visibly firms up. The keyboard is dismissed. The placeholder changes to "Listening…". One `feedback('select')` on start.
4. **Cues land.** As the parser finds a day, date or time in the committed text, a row appears under the composer in a small "Heard" list (§5). One selection haptic per new row, the same rhythm as the onboarding demo.
5. **Stop.** Tap the mic, or silence (iOS 18+: until a final result; iOS 17: three seconds of silence). The transcript stays in the composer, editable; the Heard rows stay. Send is enabled. Leaving the screen, a phone call, or backgrounding stops listening and keeps the words.
6. **Send.** The existing `run({ kind: 'text', text }, 'Voice')`. The Reading skeleton, the review sheet, the toast: all unchanged. Batches show "from your voice note" in Your data.

What is deliberately not here: auto-send on stop (people fix a misheard "pharm" first), a waveform (reads as template UI), a separate full-screen voice mode (the composer is the place; voice is a way of filling it).

## 4. Motion

Everything from the tokens (`docs/motion.md`). No new constants.

- **Mic button:** `Press` as today. While listening, its scale follows the input volume on `springs.snappy`, between 1 and about 1.1, so it breathes with the voice and settles when you pause. Volume comes from the library's `volumechange` event (−2 to 10; below 0 is silence).
- **Transcript:** text only. No per-word animation; the ink-to-secondary split does the work.
- **Heard rows:** each enters with `enter.rise`, `layout` on the list, `exit.fade` if a row is revised away. Staggered only when several land from one final result.
- **Stop → idle:** the button's fill fades on `durations.base`.
- **Reduce Motion:** nothing extra; Reanimated jumps springs to their end state.

## 5. The cue parser (`packages/core/src/cues.ts`)

Input: a transcript string and `today`. Output: clauses with their cues.

```
type Cue = { kind: 'weekday' | 'relative' | 'date' | 'time' | 'range'; text: string; start: number; end: number };
type HeardClause = { text: string; cues: Cue[] };
heardClauses(transcript: string, today: string): HeardClause[]
```

- Split on clause boundaries: ", and", " and ", ",", ";", "then", sentence ends. Speech has no punctuation unless `addsPunctuation` is on; keep it on, but do not rely on it.
- Cues, by rule: weekdays and "next Friday"; "today", "tomorrow", "tonight", "this weekend"; dates ("Oct 24", "the 24th", "10/24"); times ("7", "7–3", "seven to three", "4:30", "noon", "9 am"); ranges built from two times around "to", "–", "till".
- A clause becomes a Heard row only when it has at least one day-ish cue or a time. "I'm so tired" never becomes a row.
- Row text: the clause, trimmed, with the cue spans in Geist Medium (no colour; colour is meaning, and this is not yet a meaning). Right side: the clearest cue, e.g. "Tue · 7 am–3 pm", formatted with the existing `formatRange`.
- What it does not do: resolve to a date, pick a category, guess course or employer, or decide task vs event. That is the model's job, and the review sheet shows the result.

Tests: a table of 40–60 transcripts from the personas in `lib/majors.ts` (nursing, engineering, CS, working) with the expected rows, plus the negative cases (no cues, numbers that are not times: "chapter 6", "room 204", "PSYC 101").

Bonus the design earns: the same parser can run on typed text, so the Heard rows appear while someone types too. Same component, zero extra work, and it makes the typed path feel as alive as the spoken one.

## 6. Code shape

- `apps/mobile/src/lib/voice.ts`: `useVoiceCapture()` → `{ state: 'idle' | 'listening' | 'stopping', transcript: { committed, interim }, level, start(), stop(), error }`. Wraps the library's events, owns permissions, stops on blur/background/interruption. Everything about the library stays in this file so a swap (or a test double) touches one place.
- `Composer.tsx`: new optional `voice` prop with the state, level and handlers; renders the mic/stop button and the two-tone transcript. Onboarding passes nothing and sees no mic.
- `apps/mobile/src/components/Heard.tsx`: the rows, fed by `heardClauses(text, today)`.
- `AddScreen.tsx`: wires the hook to the composer and the Heard list; `run(..., 'Voice')`.
- `app.json`: the `expo-speech-recognition` plugin with both permission strings ("Semli listens so you can say what's coming up instead of typing it." / "Semli turns what you say into text on this phone."). `expo-audio`'s `microphonePermission` stays `false`; the speech plugin owns the string.
- `review.tsx` `sourceNoun` and `settings/data.tsx` `fromSource`: "voice" → "your voice note".
- `lib/analytics.ts`: `voice_started`, `voice_stopped { seconds, words, rows }`, `voice_failed { reason }`; `import_started` gets `kind: 'voice'` (the request kind is still text).

## 7. Edge cases, decided

- **No on-device model yet** (first use, or a language without one): see §8.
- **Offline and no on-device model:** "Voice needs a connection right now. You can still type it."
- **Recognition error mid-sentence:** keep the committed text, drop the partial, show the error line, go idle.
- **Interruption (call, Siri):** stop, keep the text. No retry.
- **Backgrounded:** stop. The transcript is saved as the capture draft, like typed text.
- **Very long dictation:** the request caps at 20,000 characters; stop listening at 2,000 with "That's plenty. Send it, then say the rest." The model does better with one week at a time anyway.
- **Picked a screenshot while listening:** stop first, then open the picker.
- **Simulator:** recognition is unreliable there. Device only; keep a `dev-command.txt` seed that fills a transcript so the Heard rows can be screenshotted.

## 8. Decisions taken Oct 21, 2026

Network fallback allowed with on-device preferred; Phases 1 and 2 built together; Siri is Phase 3 and Plus-only. The questions as asked, for the record:

1. **Network fallback.** When the on-device model is missing, let Apple recognise over the network (audio goes to Apple, not Semli; the privacy page must say so), or refuse with "Voice isn't ready on this phone yet"? Recommendation: allow it, state it plainly, and prefer on-device whenever `supportsOnDeviceRecognition()` is true.
2. **Phase 2 before data?** Phase 1 (mic, live transcript, send) is a day; the cue parser and Heard rows are the larger half. Recommendation: ship Phase 1 to TestFlight first, watch `voice_started` versus typed sends, then decide whether the rows are worth it or whether voice itself is the win.
3. **Siri / App Intents.** "Hey Siri, add to Semli: clinical Tuesday 7 to 3" is the hands-free version people actually use, and it skips the app entirely. **Decided: Phase 3, and a Plus feature.** In-app voice stays free (it is an input, like typing); Siri is the hands-free edge Plus pays for. Needs an App Intent (native code through a config plugin or a small Expo module), the same text extraction, and the review sheet opening on launch.

## 9. Phases

| Phase | Scope | Done when |
|---|---|---|
| 1 | Library, plugin, permissions, mic in the composer, live two-tone transcript, stop rules, send as text, source "Voice", analytics | A new TestFlight build: say a week, see it in review. Tested on a device in both appearances, with Reduce Motion, with VoiceOver, with the mic denied. |
| 2 | `cues.ts` with tests, Heard rows with motion, mic level pulse, rows for typed text too | Rows appear within a beat of the final result; the persona table passes; nothing on the row suggests it was added. |
| 3 (later) | Siri App Intent (Plus), auto-send preference, voice in Create | Data from Phases 1–2 says voice is used. |

## 10. What to measure

`voice_started` per Add view; `voice_stopped.seconds` (a healthy median is 8–15 s); `voice_failed.reason` split (denied, offline, error); `import_succeeded` with `kind: 'voice'` versus `text`; review commit rate for voice versus typed. If voice imports are committed at the same rate as typed ones, the transcript is good enough. If lower, look at the misheard-word problem before adding anything.
