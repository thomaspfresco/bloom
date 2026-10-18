# AI inference

The original server ran Keras models behind `POST /generate`. They are small LSTMs (0.26-1.5 MB each), so they now run in the browser: no server, no cold start, no TensorFlow on Vercel.

## Pipeline

```
tools/source_models/*.h5 ──tools/export_models.py──► public/models/<name>.json + <name>.bin
                                                       │ (architecture + float32 weights)
ai/ModelStore.js  fetch + cache ──► ai/lstm.js  (Embedding / LSTM / Dense)
                                                       │ Stepper.step(token | vector) -> probabilities
ai/generators/*.js  sampling + music rules ──► ai/Generator.js  (4 suggestions per request)
```

`tools/export_models.py` needs TensorFlow (dev only) and fails loudly on layers `lstm.js` does not implement. Models: `harmonyAndBass` (chord degrees, 8 classes), `durations2..5` (step counts, 65 classes), `drums1..4` and `brakes` (6 parts per step, sigmoid).

## The runtime (`ai/lstm.js`)

Float32Array math. LSTM gate order along the 4×units axis is i, f, g, o (Keras). Because every layer is causal, feeding one step at a time while keeping the recurrent state gives exactly the output the old code got by re-running the whole padded sequence and reading `[len-1]`. `Stepper` therefore does O(1) work per generated step.

### Verified against Keras

- `tests/js/lstm.test.js` replays seven recorded Keras input/output sequences (every model family) from `tests/fixtures/lstm.golden.json`; maximum difference < 1e-5. Regenerate with `tools/make_golden.py`.
- Distribution check (one-off, 2026-10-16): 200 drum patterns, 400 harmony and 400 bass suggestions from the **original Python** vs 1000 / 1000 / 1000 from the JS port. Drum notes per pattern 51.5 vs 50.7; per-cell (part × step) mean absolute difference 0.012 (expected sampling noise ≈ 0.03); harmony chord-count and first-duration histograms and bass note-count histograms agree within noise. The scripts are `tools/compare_generators.py` and `tools/compare_generators.mjs`.

## Generators (`ai/generators/`)

All take a `Random` (`core/random.js`, seedable) and a `LoopContext` (kind -> ordered notes of the loop; **order matters**).

| File | Port of | Behaviour |
|---|---|---|
| `sequences.js` | `generateChordProgression`, `generateDurations`, `calculateChordNumProb` | Autoregressive sampling; class 0 masked and the rest renormalised. Chord count: 4 (50%), 3 (20%), 2 (15%), 5 (15%). Duration seed: first (50%), second (25%), else a random later one. |
| `harmony.js` | `generateHarmony`, `identifyChords` | No bass in the loop: random key (or detected from melody), progression from the model, 20% chance of 7th chords, optional "neutral" power chords. Bass present: chords derived from the bass line (passing notes < 8 steps are folded in). Octave 4. |
| `bass.js` | `generateBass`, `identifyRoots`, `addPassingNotes` | No harmony: roots from the model. Harmony present: roots found by matching chords to triads/sevenths; 25% chance of the fifth. Then passing-note splitting (uses Python-style banker's rounding). Octave 2. |
| `drums.js` | `generateDrums` | Picks one of 4 style models, samples 32 steps from a seed hit (Bernoulli per part per step); 40% chance (styles 2 and 4 only) of a 16-step "break" model for the second half of the repeat; the pattern is written twice (steps 0-31, 32-63); optional crash. |
| `keyDetection.js` | `punctuateKey` | Scores each major key: +2 tonic, +1 in scale. |
| `Generator.js` | Flask route | `suggest(kind, context)` -> 4 `Candidate`s `{label, notes}`, clipped to 64 steps. `MELODY` throws (never implemented). |

Suggestions are generated sequentially (not concurrently) so seeded runs are reproducible.

## Adding or replacing a model

1. Train/obtain a Keras model using Embedding, LSTM(tanh/sigmoid), Dense, optionally `TimeDistributed(Dense)`.
2. Put the `.h5` in `tools/source_models/`, run `python tools/export_models.py`.
3. Add a golden case to `tools/make_golden.py`, run it, and run `npm test`.
4. Use `models.get('<name>')` in a generator.

## Pitch detection (HUM/SING)

The old server had a Spotify Basic Pitch endpoint, disabled in the repository. The port uses a small pure-JS YIN tracker (`audio/pitch/`), which suits one hummed or sung voice, needs no model download and is unit-tested with synthetic melodies (`tests/js/pitch.test.js`). Chords or instruments would need Basic Pitch in the browser (vendored TF.js, ~3 MB, lazy-loaded); see [ROADMAP.md](ROADMAP.md).
