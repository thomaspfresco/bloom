# Roadmap and status

Legend: ✅ done and tested, 🟡 done, verified by hand / e2e only, ⬜ not started.

Last full verification: 55 Node unit tests, 20 pytest tests, strict `tsc --checkJs`, and 10 browser end-to-end checks (`npm run e2e`) all pass.

## Foundation

| Area | Status | Notes |
|---|---|---|
| Flask app, Vercel config, pages, `/api/midi` | ✅ | `pytest tests/py` |
| Model classes, parameters, presets, note operations | ✅ | `tests/js/model.test.js` |
| Session persistence (localStorage, file, legacy import) | ✅ | unit tests + e2e reload / corrupt-data check |
| Model export + JS LSTM | ✅ | parity with Keras < 1e-5 |
| Harmony / bass / drums generators | ✅ | output distributions match the original Python |
| Playback cursor | ✅ | `tests/js/cursor.test.js` |
| Audio engine (voices, FX, sequencer, MIDI in) | 🟡 | e2e: live peak level and offline render checked |
| Offline audio export (WAV) | 🟡 | e2e: non-silent mix; muting tracks changes the level |
| three.js scene (WebGPU, WebGL2 fallback) | 🟡 | 60 fps with 50 loops in the drawer |

## Compose UI (port of `compose.js`)

| Feature | Status |
|---|---|
| Home screen: Oblique Strategies, BLOOM / session menu | 🟡 |
| Tabs (max 4), per-tab menu (export, rename, duplicate, struct from, close, delete) | 🟡 |
| Session menu: about, tutorial, download, import, clear | 🟡 |
| Loops drawer: search, create, fisheye, hover preview, open, drag out | 🟡 |
| Structures drawer (same) | 🟡 |
| Loop view: track ribbons with note petals, track icons, "+" menu, mute, delete | 🟡 |
| "+ track": from scratch / 4 AI suggestions with live preview (solo, octave, regenerate) | 🟡 |
| Grid editor: draw, move, resize (wheel), marquee select, delete, octave window, time bar seek | 🟡 |
| Studio view: knobs, toggles, volume fader, L/R meters, presets | 🟡 |
| Automation view | 🟡 |
| Structure view: sections, repeats, reorder by drag, drop from drawers, tempo/transpose, dice | 🟡 |
| Computer keyboard and MIDI keyboard play + record into the track | 🟡 |
| Export: WAV (loop / structure), MIDI (track) | 🟡 |
| HUM/SING: microphone take -> melody track | 🟡 |
| About / Help / Import pages | 🟡 |
| "Desktop only" notice | 🟡 |

## Known gaps and ideas

- Undo/redo: the original had inert icons; not ported.
- Reverb decay automation is not rendered in exported audio (decay is fixed for the render, see [AUDIO.md](AUDIO.md#offline-export)).
- Two tabs open at once overwrite each other's autosave (last writer wins). A `storage` event listener could warn.
- Pitch detection is monophonic YIN. Polyphonic transcription (Spotify Basic Pitch in the browser) would need a vendored TF.js bundle (~3 MB, lazy-loaded).
- Melody AI suggestion (the original function was a stub).
- Custom drum samples via the import page.
- Content-hashed module URLs for instant cache busting.
- Touch / mobile layouts.
