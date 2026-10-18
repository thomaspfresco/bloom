# Development

## Setup

```bash
python3 -m venv .venv && . .venv/bin/activate     # a .venv already exists in a fresh checkout of this workspace
pip install -r requirements-dev.txt               # Flask, mido, pytest
npm install                                       # typecheck + e2e tooling only (no build step)
python app.py                                     # http://127.0.0.1:5000  (debug reload on)
```

Edit files in `public/` and refresh; there is nothing to build.

## Tests

| Command | Covers |
|---|---|
| `npm test` | model, persistence (incl. legacy fixture), note operations, LSTM parity with Keras, generators, playback cursor, grid geometry, pitch tracking (55 tests) |
| `pytest tests/py` | Flask pages, static serving, MIDI export mapping and validation (20 tests) |
| `npm run build:three` | rebuild the tree-shaken three.js bundle (after adding a `three` import) |
| `npm run typecheck` | JSDoc types, `strict` (`jsconfig.json`; three.js types from `@types/three`) |
| `npm run e2e` | 10 browser checks against a running server (below) |

### End-to-end (`tests/e2e/smoke.mjs`)

Drives a real Chrome with `playwright-core`: boot and GPU backend, loop/track/note creation and views, drawing a note with the pointer, AI suggestions (hover preview + keep), drag a loop from the drawer into a structure, offline export is not silent, live playback level, reload persistence and corrupt-data quarantine, MIDI export, and the whole HUM/SING flow using a fake microphone that plays a known melody.

```bash
python app.py &                                  # server on :5000
BLOOM_URL=http://127.0.0.1:5000 CHROME_PATH="/path/to/chrome" npm run e2e
```

Tips for new checks: the app exposes `window.__bloom` (`{ctx, scene}`) for tests; zero-height elements (drawer items) need `waitForSelector(..., {state: 'attached'})`; wait ~2 s after a change before asserting on autosaved storage (1.5 s debounce).

## Tools (dev-time, not deployed)

| Script | Purpose | Needs |
|---|---|---|
| `tools/export_models.py` | `tools/source_models/*.h5` -> `public/models/` | TensorFlow |
| `tools/make_golden.py` | Keras outputs for parity tests -> `tests/fixtures/lstm.golden.json` | TensorFlow |
| `tools/compare_generators.{py,mjs}` | Compare output distributions of the old Python generators and the JS port | the old `bloomServer` checkout |

## Manual checks

1. `python app.py`, open the page in a current Chrome. The console prints `[bloom] backend: webgpu|webgl`.
2. Add `?gl=1` to force the WebGL2 path.
3. Headless Chrome needs `--enable-unsafe-webgpu` for WebGPU; without it three.js uses WebGL2.

## Coding standards

See [LLM_GUIDE.md](LLM_GUIDE.md#conventions). Short version: `// @ts-check` everywhere, JSDoc types, named exports, one class per file, comments explain why, pure logic gets a Node test.

## Keeping docs current

Docs are part of the change. When you:

- add/move a module -> [ARCHITECTURE.md](ARCHITECTURE.md) layer list and [PORT_MAP.md](PORT_MAP.md);
- change saved data -> [STATE_MODEL.md](STATE_MODEL.md) (and bump `SESSION_VERSION`);
- change playback, a parameter mapping or an export -> [AUDIO.md](AUDIO.md);
- change a generator or model -> [AI_INFERENCE.md](AI_INFERENCE.md);
- change drawing or layout geometry -> [RENDERING.md](RENDERING.md) / [UI_COMPONENTS.md](UI_COMPONENTS.md);
- deviate from the old behaviour -> [PORT_MAP.md](PORT_MAP.md#deliberate-changes);
- finish or add a feature -> [ROADMAP.md](ROADMAP.md);
- make a design choice someone will ask about -> [DECISIONS.md](DECISIONS.md).
