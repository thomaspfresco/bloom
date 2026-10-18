# Architecture

## One app

```
Browser                                        Vercel
┌──────────────────────────────────────┐      ┌───────────────────────────┐
│ HTML + CSS UI (public/js/ui)         │      │ Flask function (app.py)   │
│   ▲ reads            │ events        │      │   GET  /, /about, /help…  │
│   │                  ▼               │ HTTP │   POST /api/midi          │
│ Session (model/)  ◄──────────────────┼──────┼─►  GET  /api/health       │
│   │   │   │                          │      └───────────────────────────┘
│   │   │   └─► persistence/ ─► localStorage / JSON file   ┌────────────┐
│   │   └─────► ai/ (LSTM in JS) ◄── fetch /models/*  ◄────┤ CDN: public │
│   └─────────► audio/ (Tone.js) ◄── fetch /samples/*      └────────────┘
│ scene/ (three.js WebGPU) on #scene canvas behind the UI
└──────────────────────────────────────┘
```

Flask does three things: render page shells, convert a track to a `.mid` file, and answer a health check. Everything else is static.

## Module layers (public/js)

```
core/         constants, ids, math, seedable random, event emitter, colours
music/        pure music data: theory tables, scales, presets, parameter option tables, track kinds
model/        Session, Loop, Track, Note, Structure, Parameter  (plain data, JSON in/out)
persistence/  localStorage autosave, JSON file export/import, legacy-format converter
ai/           LSTM runtime, model loader, generators (harmony, bass, drums), Generator facade
audio/        Tone.js: voices, FX, playback cursor + sequencer, offline export, MIDI input, microphone recording, pitch detection
scene/        three.js: renderer, instanced batches, actors, layers; DOM anchors and grid geometry (shared with the UI)
ui/           DOM components, controllers, state (imports everything below it)
pages/        entry points, one per HTML page (compose.js, upload.js)
```

Rule: a layer may import only from layers above it in this list. (`scene/core/gridMath.js` and `anchors.js` live in `scene/` so both the scene and the UI can use them without `scene` importing `ui`.) `model`, `music`, `ai`, `persistence` run in Node (that is how they are unit-tested).

## Data flow

1. `pages/compose.js` creates a `Session`, loads it with `SessionStorage.load()` (validated; corrupt data is quarantined) and starts autosave.
2. UI components read the session and subscribe to its `change` events. User actions call session methods (or mutate a loop/track and call `session.touch(scope)`); autosave debounces a write.
3. Playback: `AudioEngine.playLoop(loop)` -> `Sequencer` schedules `Tone.Transport` ticks -> `PlaybackCursor.advance()` returns what happens on each 16th step -> `playTick` configures voices and triggers notes. `tick` events (synchronised with what you hear via `Tone.Draw`) drive playhead UI and scene.
4. Generation: UI asks `Generator.suggest(kind, loop.toGenerationContext())`; it returns four candidates. Previewing a candidate temporarily replaces the track list the sequencer plays.
5. Rendering: each animation frame the scene layers read the session (and DOM anchor rectangles) and push instances into five batches; the renderer draws them.

## Why a cursor?

`PlaybackCursor` contains all sequencing rules (wrap, repeats, structure sections, transpose, tempo override, click) and has no audio dependency. Live playback and offline WAV export both use it, so exported audio cannot drift from what you hear, and the rules are unit-tested in Node.

## Frontend without a build step

Native ES modules plus an import map (`templates/base.html`) for `three`. Tone.js is a classic `<script>` (its UMD bundle) exposed as `globalThis.Tone`; `audio/tone.js` is the single place that reads it. three.js is a tree-shaken bundle (`public/vendor/three/three.bundle.js`, about 1 MB instead of 3.7 MB) built by `npm run build:three` (`tools/build_three.mjs` scans `public/js` for `three` imports, so rebuild after adding one); the import map points every `three` specifier at it. Other third-party code is vendored in `public/vendor/` (pinned versions, licences included), so there is no CDN dependency at runtime.
