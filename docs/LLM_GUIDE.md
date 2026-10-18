# Guide for LLMs and new contributors

Read this before editing. It is deliberately dense.

## What this is

One Flask app (`app.py` -> `bloom/`) that serves `templates/*.html` and static files from `public/`. All product logic is browser JavaScript in `public/js/` using native ES modules: **no bundler, no transpiler, no framework**. Types are JSDoc checked with `// @ts-check` (`npm run typecheck`).

## Invariants (do not break)

1. **Layering.** Dependencies point downward only: `core` <- `music` <- `model` <- (`persistence`, `ai`, `audio`) <- (`scene`, `ui`) <- `pages`. `model/`, `music/`, `ai/` (except `ModelStore` fetch) and `persistence/` must stay importable in Node (tests rely on it): no `window`, `document`, Tone or three.js at module top level in those layers.
2. **State is plain data.** `Session`/`Loop`/`Track`/`Note`/`Structure` hold no audio nodes, DOM, or drawing state. Playhead, hover, drag and animation state live in `audio/`, `scene/` or `ui/`.
3. **Ids, not indexes.** Everything references everything else by string id (`loop.id`, `track.id`, ...). The old app used array indexes and re-indexed on delete.
4. **One audio entry point.** UI code uses `AudioEngine`; only `public/js/audio/` imports Tone (via `audio/tone.js`).
5. **One canvas.** `#scene` is a fixed full-viewport `<canvas>` behind `#app` with `pointer-events: none`. The DOM owns all interaction and text. The scene reads DOM rectangles ("anchors") to know where to draw. See [RENDERING.md](RENDERING.md).
6. **Scene units are CSS pixels, y down**, origin top-left (same as the p5 sketch and the DOM).
7. **Never trust stored or imported JSON.** `Session.fromJSON` and its children sanitise; keep it that way.
8. **No server state.** Flask is stateless; do not add file writes (Vercel's filesystem is read-only apart from `/tmp`).
9. **Static assets live in `public/`**, never Flask's `static_folder` machinery on Vercel (see [DEPLOYMENT.md](DEPLOYMENT.md)).

## Where do I change X?

| Task | Files |
|---|---|
| Add a track parameter / FX knob | `model/parameterSpecs.js` (+ `audio/Voice.js` to make it audible, + presets in `music/presets.js`) |
| Change a preset | `music/presets.js` |
| Change how a loop plays (timing, wrap, repeats) | `audio/playback/PlaybackCursor.js` (pure, has tests: `tests/js/cursor.test.js`) |
| Change what a voice does with parameters | `audio/Voice.js` |
| Change generation (probabilities, rules) | `ai/generators/*.js`; seeds via `core/random.js` |
| Use a different model | `tools/export_models.py` -> `public/models/`; loader in `ai/ModelStore.js`, math in `ai/lstm.js` |
| Change the saved-session shape | `model/*` `toJSON`/`fromJSON`, bump `SESSION_VERSION` in `core/constants.js`, add migration in `persistence/` |
| Change visuals (petals, ribbons, particles) | `scene/layers/*`, primitives in `scene/batches/*` |
| Change layout / look of UI | `public/css/*`, `ui/` components |
| Add a page | `bloom/routes/pages.py`, `templates/`, `public/js/pages/` |
| Add an API endpoint | `bloom/routes/api.py`, logic in `bloom/services/` (keep it stateless) |
| Add a UI component | `public/js/ui/components/`, mount it in `App.js` (or a parent view), styles in `public/css/` |
| Add something the canvas must draw | a layer in `scene/layers/` reading `session`, `ui.s` and `anchors`; add it in `App.js` |
| Change the New Track flow | `ui/controllers/GenerateController.js` + `ui/components/GenerateOverlay.js` |
| Change keyboard shortcuts | `ui/controllers/Keyboard.js` |
| Change pitch detection | `audio/pitch/*.js` (pure, tested in `tests/js/pitch.test.js`) |

## Conventions

- ES2022, `// @ts-check` at the top of every JS file, JSDoc for public APIs, no default exports (named exports only).
- One class per file; file name = class name. Pure helpers in lower-case files.
- Comments explain *why* or point at the old p5/Flask behaviour being preserved; do not narrate code.
- Tests next to behaviour: pure logic gets a `node:test` test in `tests/js/`.
- Constants that existed in the old sketch keep their meaning (e.g. 64 steps, 4 tracks); they live in `core/constants.js`.
- Intentional deviations from the old behaviour are recorded in [PORT_MAP.md](PORT_MAP.md#deliberate-changes). Add to it when you make one.

## Commands

```bash
python app.py                    # run
npm test                         # JS unit tests
pytest tests/py                  # Flask + MIDI tests
npm run typecheck                # JSDoc type check (strict)
npm run e2e                      # browser end-to-end checks (server must be running)
python tools/export_models.py    # re-export Keras models (needs TensorFlow)
```

## Pitfalls seen so far

- Generating the four AI suggestions concurrently makes seeded output depend on network timing; keep them sequential (`ai/Generator.js`).
- Tone's `Offline` renderer needs drum samples loaded *before* the graph is built (`audio/exportAudio.js` preloads them).
- A `Section` in a structure points at a loop by id; deleting a loop removes those sections (`Session.deleteLoop`).
- Offline audio: create voices before `Tone.Offline` renders, and never let a reverb's decay change mid-render (see [AUDIO.md](AUDIO.md#offline-export)).
- The canvas sits *behind* the DOM, so a DOM overlay darkens scene drawings too. Dimming that must keep scene content bright is done in the canvas (`frame.dim` + `frame.overlay`).
- three.js node materials need `side: DoubleSide` here: the camera flips y, which reverses winding.
- Components build their DOM in the constructor (not a `build()` hook); fields assigned in other methods are typed `T | undefined` by `tsc`.
- `Emitter` has a type-only `eventTypes` marker so `Component.listen` can infer payload types; do not remove it.
- `Intl`/locale: note names are fixed English sharps (`music/theory.js`).
