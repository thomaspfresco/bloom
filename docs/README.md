# BLOOM documentation

Documentation for people and LLMs working on the port. Every file is short and single-purpose; update the relevant one in the same change as the code (see "Keeping docs current" in [DEVELOPMENT.md](DEVELOPMENT.md)).

| File | Read it to learn | Audience |
|---|---|---|
| [LLM_GUIDE.md](LLM_GUIDE.md) | Conventions, invariants, "where do I change X?" cheat sheet | LLMs first, everyone second |
| [ARCHITECTURE.md](ARCHITECTURE.md) | The one-app design, module layers, dependency rules, data flow | everyone |
| [PORT_MAP.md](PORT_MAP.md) | Where each part of the old p5 / Flask code went, and deliberate behaviour changes | anyone comparing with the old repos |
| [STATE_MODEL.md](STATE_MODEL.md) | Session / Loop / Track / Note / Structure classes and the saved JSON schema | anyone touching data |
| [AUDIO.md](AUDIO.md) | Tone.js engine, voices, sequencer, offline export | audio work |
| [AI_INFERENCE.md](AI_INFERENCE.md) | Model export, the JS LSTM, the generators, how parity with Keras was checked | AI work |
| [RENDERING.md](RENDERING.md) | The full-viewport three.js canvas, batches, the DOM/scene split, layout geometry | graphics / UI work |
| [UI_COMPONENTS.md](UI_COMPONENTS.md) | HTML/CSS components and views, how they get state | UI work |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Vercel + Flask setup, limits, caching | deploying |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Running, testing, tools, coding standards | contributors |
| [ROADMAP.md](ROADMAP.md) | What is ported, what is not, what is next | planning |
| [DECISIONS.md](DECISIONS.md) | Why things are the way they are (short ADRs) | the curious |

## One-paragraph summary

BLOOM is one Flask app. Flask serves Jinja page shells and a stateless `POST /api/midi`; everything else is static files in `public/`. The browser runs ES modules (no bundler) that keep a `Session` in memory, autosave it to `localStorage`, play it with Tone.js, generate music with a JS port of the original LSTMs, and draw petals, lines and particles with three.js on a single fixed full-viewport canvas behind the HTML UI.
