# BLOOM

A generative loop composer. Sketch loops on a grid, let small neural networks suggest bass, harmony and drums, and arrange loops into structures. Everything musical runs in your browser; there are no accounts and no server-side state.

This repository is the single-app port of the original two-repo project (`bloomClient`: React + p5.js, `bloomServer`: Flask + TensorFlow). See [docs/PORT_MAP.md](docs/PORT_MAP.md) for what moved where.

| | Before | Now |
|---|---|---|
| Hosting | two apps (Vite client + Flask server) | **one Flask app on Vercel** |
| Graphics | p5.js in `WEBGL` mode, UI drawn by hand | **three.js (WebGPU)** for petals, lines and particles on one full-viewport canvas; **HTML + CSS** for everything else |
| AI | Keras `.h5` models behind `POST /generate` | the same models, exported and run **in the browser** (pure JS LSTM) |
| Sessions | pickled on the server by token | `localStorage`, plus JSON download / import |
| MIDI export | `pretty_midi` | `mido` (Flask `POST /api/midi`) |

## Run it

```bash
python3 -m venv .venv && . .venv/bin/activate     # skip if .venv already exists
pip install -r requirements-dev.txt               # Flask, mido (+ pytest)
python app.py                                     # http://127.0.0.1:5000
```

No Node build step is needed. Node is only used for tests and type-checking:

```bash
npm install                   # typescript, for `npm run typecheck`
npm test                      # unit tests (Node's built-in runner)
pytest tests/py
```

WebGPU needs a current Chrome, Edge, Safari or Firefox; otherwise three.js falls back to WebGL2 automatically (force it with `?gl=1`). Audio starts after the first click or key press (browser autoplay rules).

## Deploy

Push to a Vercel project; Vercel detects `app.py` and runs it as a Flask function. Static files in `public/` are served by the CDN. Details in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Layout

```
app.py                 Vercel / local entrypoint (exports `app`)
bloom/                 Python package: app factory, routes (pages, /api/midi), MIDI service
templates/             Jinja page shells
public/                everything the browser loads (served at the site root)
  js/                  ES modules, no bundler: core, music, model, persistence, audio, ai, scene, ui, pages
  css/                 tokens, base, components
  models/              exported neural-network weights (JSON + float32 .bin)
  meshes/ fonts/ img/ samples/ vendor/
tools/                 dev-only scripts (export Keras models, generate test fixtures)
tests/                 js (node:test) and py (pytest)
docs/                  documentation for people and LLMs, start at docs/README.md
```

## Documentation

Start with [docs/README.md](docs/README.md). If you are an LLM or new to the code, read [docs/LLM_GUIDE.md](docs/LLM_GUIDE.md) first.

## Credits

BLOOM (2023-2024) by Thomas Fresco, a dissertation project for the Master in Design and Multimedia, Department of Informatics Engineering, University of Coimbra. The home-screen quotes are Brian Eno and Peter Schmidt's *Oblique Strategies*. Three.js and Tone.js are vendored under their own MIT licences (see `public/vendor/`).
