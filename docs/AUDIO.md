# Audio

Everything audible is in `public/js/audio/`; only `audio/tone.js` touches `globalThis.Tone` (Tone.js 14.7.77, vendored as a classic script).

## Pieces

| File | Role |
|---|---|
| `AudioEngine.js` | Facade used by the UI: `unlock()`, `playLoop`, `playStruct`, `stop`, `seek`, `noteOn/noteOff/blip`, `exportLoop/exportStruct`, level meters. Emits `tick`, `start`, `stop`. |
| `Sequencer.js` | Live playback. Schedules `Tone.Transport` every `16n`, asks the cursor what to do, triggers voices, emits `tick` through `Tone.Draw` so UI matches what is heard. |
| `playback/PlaybackCursor.js` | **Pure** sequencing rules. One `advance()` = one 16th step -> `Tick` (loop, step, section/repeat, wrapped, bpm, click, tracks, note-ons/offs). Handles loop wrap, structure sections and repeats, tempo override, transposition, muting, finite mode (for export). Unit-tested. |
| `playback/playTick.js` | Applies a `Tick` to voices (shared by live and offline). |
| `VoiceBank.js` | One voice per track *kind* (like the old shared synths). `prepare(track, step)` copies the track's parameters (with that step's automation) onto its voice. Lazy creation (reverb is costly). |
| `Voice.js` | `SynthVoice` (two `PolySynth`s with envelopes) and `DrumVoice` (seven `Player`s). Port of `updateSynthParams`, with a change cache so unchanged values are not re-sent to Tone. |
| `FxChain.js` | filter -> distortion -> ping-pong delay -> reverb -> gain -> limiter -> L/R meters -> panned to output. |
| `drumKits.js` | Sample URLs (`/samples/{kick,snare,...}_{subtle,acoustic,electronic}.wav`) and cached loading. |
| `Metronome.js` | Click samples (`mUp.wav` accent, `m.wav` beat). |
| `exportAudio.js`, `wav.js` | Offline render with `Tone.Offline` using the same cursor; 16-bit PCM WAV encoder. |
| `MidiInput.js` | Web MIDI note on/off with the old octave mapping. |
| `MicRecorder.js` | `Tone.UserMedia` + meter + `Tone.Recorder`; `open()` never throws (returns `denied` / `unsupported` / `error`), `stop()` decodes to mono samples. |
| `RecordingSession.js` | One take: 16-step count-in (always clicked), then 64 steps recorded; emits per-step levels and `done` with samples and the capture start offset. |
| `pitch/yin.js`, `pitch/transcribe.js` | Pure DSP (Node-tested): YIN pitch per frame -> median filter -> semitone runs -> notes quantised to 16th steps. |

## Timing rules (unchanged from the old app)

- One tick = a 16th note; steps 0-63; at the end of step 63 the next tick wraps to 0 and all held notes are released.
- `Transport.bpm` follows the loop's tempo each tick (or the structure's when `useTempo`).
- A note-on fires on `note.start`; a note-off on `note.start + duration` (not for drums, which are one-shots). Notes ending at step 64 are released by the wrap.
- Closed hat (part 2) chokes open hat (part 3).
- Click: accent on steps divisible by 16, beat on steps divisible by 4.
- Structure: each section plays its loop `repeats` times, then the next; after the last it starts over (live) or finishes (export).
- Offline length: loop = 64 steps + 25% tail; structure = sum of sections + 5 s.

## Parameter mapping (`Voice.js`)

Synth: oscillator `type` = wave table entry; `detune` = pitch cents; `volume` = 0..1 mapped to -50..0 dB (0 -> -Infinity, off when toggle is off); envelope A/D/S/R from the time/unit tables (off -> 0/0/1/0); filter cutoff 100..10000 Hz (off -> 20 kHz); distortion wet 0.5 and amount (off -> 0); delay time `"1/16"` -> `"16n"`, feedback, wet (off -> 0); reverb decay and wet (off -> wet 0, decay 0.01).
Drums: per part volume 0..1 -> -48..0 dB (0 or toggled off -> -Infinity), playback rate = remap(semitones, -12..12 -> 0.02..2).

## Offline export

`renderPlan(plan)` renders with `Tone.Offline`, driving the same `PlaybackCursor` + `playTick` as live playback. Two Tone facts shaped it:

1. Voices created *inside* the render callbacks never reach the output. `VoiceBank.warmUp(tracks)` therefore creates and configures every voice (and waits for reverb impulse responses) before the transport starts.
2. A `Tone.Reverb` rebuilds its impulse response asynchronously whenever `decay` changes, and is silent until it finishes. Voices are created with `lockReverbDecay`, so the decay is fixed up front (the first track of each kind decides); wet/dry still follow automation.

Also: inside an offline callback use `.toDestination()` / `Tone.getDestination()`, never the global `Tone.Destination` (it belongs to the live context).

Check: `npm run e2e` renders a loop and requires RMS > 0.02; muting tracks lowers the level as expected.

## Recording a melody

`RecordController` (UI) opens the mic, then on Space `RecordingSession` runs a count-in and a 64-step take at the loop's tempo. Capture start is measured (`startedAt - step0Time`) and, with a 50 ms allowance for input latency, passed to `transcribeMelody` as `latencySeconds` so notes land on the right steps. Silence is gated at 12% of the take's peak; notes shorter than 60 ms are dropped; monophonic only.

## Autoplay

Browsers keep audio suspended until a gesture. The compose page calls `engine.unlock()` on the first pointer or key event.

## Testing

`PlaybackCursor` and `wav.js` are Node-testable (`tests/js/cursor.test.js`). Code that needs Tone is verified in a real browser (see [DEVELOPMENT.md](DEVELOPMENT.md#browser-checks)).
