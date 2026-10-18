# Port map: old code -> new code

Old repos: `bloomClient` (React 18 + Vite + p5.js 1.9 + Tone.js 14) and `bloomServer` (Flask + TensorFlow/Keras + pretty_midi).

## Server

| Old (`bloomServer`) | New |
|---|---|
| `server.py` `/getToken`, `/save`, `/load`, `/upload`, token folders under `clients/` | **Removed.** Sessions are in `localStorage`; see [STATE_MODEL.md](STATE_MODEL.md). No expiry/cleanup: the page validates what it loads. |
| `/generate` (multiprocessing for drums) | `public/js/ai/Generator.js`, sequential, in the browser |
| `musicGeneration.py` | `public/js/ai/generators/{harmony,bass,drums,sequences,keyDetection}.js`, `music/scales.js` |
| `models/*.h5` | `tools/source_models/*.h5` -> `tools/export_models.py` -> `public/models/*.{json,bin}` |
| `/renderMidi` (pretty_midi) | `bloom/routes/api.py` `POST /api/midi`, `bloom/services/midi.py` (mido) |
| `basicPitch.py` + client `:5001` | Disabled in the old repo. Replaced by in-browser YIN pitch tracking: `audio/pitch/yin.js`, `transcribe.js` |
| `templates/index.html` | `templates/*.html` |

## Client

| Old (`bloomClient/src`) | New (`public/js` unless noted) |
|---|---|
| `main.jsx`, `App.jsx` (router), `Pages/*.jsx` | Flask routes + `templates/` + `pages/*.js` |
| `Pages/compose.jsx` (axios calls, p5 mount) | `pages/compose.js`; no HTTP except `/api/midi` |
| `Pages/upload.jsx` (audio upload to server) | `/upload` page: session JSON import (`pages/upload.js`) |
| `Components/Loading.jsx`, `MobileMsg.jsx` | `ui/components/*`, `#desktop-only` in `templates/compose.html` |
| `Compose/theory.js` | `music/theory.js`, `music/parameterTables.js` |
| `Compose/synths.js` presets | `music/presets.js` (data only) |
| `Compose/synths.js` FxChain / Synth / DrumSynth | `audio/FxChain.js`, `audio/Voice.js`, `audio/VoiceBank.js` |
| `Compose/synths.js` transport callback | `audio/playback/PlaybackCursor.js`, `playTick.js`, `audio/Sequencer.js` |
| `Compose/synths.js` `exportLoopAudio/exportStructAudio` | `audio/exportAudio.js`, `audio/wav.js` |
| `Compose/synths.js` MIDI input, mic recorder | `audio/MidiInput.js`, `audio/MicRecorder.js`, `audio/RecordingSession.js` |
| `compose.js` `Session`, `Loop`, `Track`, `Note`, `Structure`, `Knob`, `Button`, `Scrollable` (data parts) | `model/*` |
| `compose.js` `Session.save/initLoadedSesh/retrieveLoopInfo` | `Session.toJSON/fromJSON`, `persistence/*` |
| `compose.js` `Track.ajustNotes` | `model/noteOps.js` |
| `compose.js` `Particle`, `PetalParticle`, `PlayParticle` | `scene/layers/Backdrop.js`, `PetalFlow.js`, note particles in scene layers |
| `compose.js` drawing (`draw*`, `p.text`, `p.rect`, `p.image`, hit tests) | HTML + CSS + DOM events (`ui/`, `public/css/`) |
| `compose.js` `Menu` (states 0, 3, 5) | `ui/components/MenuHost.js` (options, confirm, prompt, about) |
| `compose.js` `Menu` state 1, 2 (+ track flow) | `ui/controllers/GenerateController.js`, `ui/components/GenerateOverlay.js` |
| `compose.js` `Menu` state 4 (recording) | `ui/controllers/RecordController.js`, record screen in `GenerateOverlay.js` |
| `compose.js` `Session.draw` drawers | `ui/components/Drawers.js`, `Drawer.js`, `scene/layers/DrawerLayer.js` |
| `compose.js` `Session.drawTabs` | `ui/components/TopBar.js` |
| `compose.js` `Loop.draw`, `Track.draw/drawNotes`, `Note.draw` | `ui/components/LoopView.js` (+ `TrackBar`, `ControlsBar`, `TimeBar`), `scene/layers/LoopLayer.js`, `scene/actors/TrackBloom.js`, `NoteVisual.js` |
| `compose.js` `Track.drawGrid`, `Note` dragging | `ui/components/GridEditor.js`, `scene/core/gridMath.js` |
| `compose.js` `Track.drawStudio`, `Knob`, `Button` | `ui/components/StudioView.js`, `Knob.js`, `Toggle.js` |
| `compose.js` `Track.drawAutomation` | `ui/components/AutomationView.js` |
| `compose.js` `Structure.draw` | `ui/components/StructView.js`, `scene/layers/StructLayer.js` |
| `compose.js` `Scrollable` | `ui/components/Scroller.js` |
| `compose.js` `p.keyPressed/keyReleased/mouseWheel`, `Session.manageRecordedNotes` | `ui/controllers/Keyboard.js`, `PlayInput.js`, `NoteEditing.js` |
| `obliqueStratagies.js` | `music/obliqueStrategies.js` |
| `Assets/*.png`, `Fonts`, `audioSamples` | `public/img`, `public/fonts`, `public/samples` |
| `Assets/petal{1..4}.obj` | `public/meshes/petal.obj` (the four files were byte-identical) |

## Deliberate changes

Behaviour that intentionally differs from the old app. Add to this list whenever you change behaviour.

1. **Ids instead of indexes** for loops, tracks, sections, tabs (no re-indexing bugs on delete).
2. **Structure sections reference loops** by id and always show the loop's current content. The old app stored copies and re-synced them by name when drawers opened; deleting a loop deleted the matching sections too (kept).
3. **Overlapping notes** (`model/noteOps.js`): the old `ajustNotes` could leave a zero-length note when an existing note ended exactly where the new one ended, and a negative-length note when an existing note's tail overlapped the new note. Both fixed.
4. **Drum suggestions** never contain duplicate hits: the original could place two crash cymbals on step 0 (when a break and the extra-crash roll both fired).
5. **Key detection** drops a no-op: the original added +3 to every key whenever a track had notes (it compared a dict with ints); a uniform offset cannot change the winner.
6. **Back-to-back notes of one pitch**: note-offs are processed before note-ons within a step, so adjacent same-pitch notes retrigger instead of the new note being cut by the previous note's release (order depended on array order before).
7. **Four suggestions are generated sequentially**, not in four processes.
8. **Sessions**: `localStorage` + JSON file instead of server tokens; no expiry. Old `log.bin` sessions (decoded to JSON) can still be imported (`persistence/legacy.js`).
9. **Tone.js 14.7.77 is vendored** (the version the old app used) rather than fetched from npm at build time.
10. **Melody "AI suggestion"** stays disabled: the original `generateMelody` returned `""`.
11. **Drawing a note by dragging** covers every column from the start to the pointer, inclusive and symmetric. The original produced one step fewer when dragging right than left.
12. **HUM/SING** uses a YIN pitch tracker (monophonic, in-browser, no model download) instead of Spotify Basic Pitch, which the old repo had disabled. Octaves are `floor(midi / 12)`, as in the old conversion.
13. **Interface fidelity pass**: the UI follows the original's behaviour. Actions happen on press (pointer down), not release; the "+" is invisible until the pointer is low on the screen; tab, view and track changes use the original's black "blackout" fades (`ui/controllers/Fades.js` + `ui/components/Blackouts.js`); menus fade a dark layer in over ~⅓ s and list options 50 ms apart. Nothing was added: no "⋯" button, no tooltips, no focus outlines, no edge buttons for the drawers. The favicon is the original's. The pixel/timing source of truth is the old `bloomClient`.
    Details taken straight from the old `Button`, `Scrollable`, `Knob`, `Menu` and `Loop.draw` code: all round on/off buttons (CLICK, RECORD, SOLO, studio modules, struct APPLY) are one component (`Toggle`): off = outline at 1/3 opacity, on = full outline plus a centre dot (CLICK/RECORD/SOLO/APPLY and track colour in the studio; SOLO takes the track colour); the CLICK dot flashes in the track colour on every beat while playing. Scrollers show real arrow images that fade in over ~⅓ s on hover and repeat every frame after 500 ms. Studio boxes, knobs and the fader are placed with the old formulas. The AI-suggestion boxes use the beige border colour (1/4 opacity, 1/2 on hover), not the track colour. Toasts, the 5 s "Session saved at HH:MM." line, the grid hints and the loading screen are the originals.
14. **Not ported / inert, as in the original**: RENAME (disabled), TUTORIAL (does nothing), undo/redo icons (shown, inert), and the text-capture trick that routed raw keystrokes into the drawer search (the drawers have a real text field instead).
15. **Dimming behind drawers** is drawn inside the canvas (so drawer content stays bright); the tab bar and loop controls dim via CSS.
16. **Dropping on a structure** requires the drawer to be closed (pointer outside it), as before, and shows the insertion gap while dragging.

Everything not listed here is intended to behave as before; report differences as bugs.
