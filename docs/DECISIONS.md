# Decisions

Short records of choices that shape the codebase. Newest last. Format: context, decision, consequence.

## 1. Flask, not Django
Context: one app, no database, no auth, no admin. Decision: Flask. Consequence: tiny serverless bundle; if accounts and saved projects are added later, add a database via Vercel integrations without changing the architecture.

## 2. No bundler, JSDoc instead of TypeScript
Context: "one app" and a static `public/` directory on a CDN. Decision: native ES modules + import map, types via JSDoc and `// @ts-check`. Consequence: no second toolchain or build step; editors still type-check; `npm run typecheck` runs `tsc --checkJs`. Switching to TypeScript later means adding esbuild and renaming files.

## 3. Assets in `public/`
Context: Vercel serves `public/**` from its CDN and says not to use Flask's `static_folder` there. Decision: all assets in `public/`, mounted at `/` locally. Consequence: identical URLs in dev and production.

## 4. Inference in the browser
Context: TensorFlow cannot fit a serverless function and the models are tiny. Decision: export weights, run a hand-written LSTM in JS (`ai/lstm.js`). Consequence: instant suggestions, no server, verified against Keras to 1e-5. Retraining still requires Keras.

## 5. Stepper instead of padded re-runs
Context: the old code re-ran a zero-padded sequence per step. Decision: stateful stepping; equivalent because all layers are causal. Consequence: O(1) per step.

## 6. Sequential generation, no workers
Context: the old server used `multiprocessing` for drums because of per-call Keras latency. Decision: run suggestions one after another on the main thread. Consequence: milliseconds per suggestion; seeded output is reproducible.

## 7. One full-viewport WebGPU canvas behind the HTML
Context: the p5 sketch drew UI and visuals in one canvas. Decision: a single fixed `<canvas id="scene">` (z-index 0, `pointer-events: none`) for petals, ribbons and particles; HTML + CSS above it for text, controls and menus. Consequence: native text, focus, accessibility and layout; the scene reads DOM rectangles ("anchors") to align with the UI.

## 8. Instanced batches, not scene-graph objects
Context: hundreds of petals, dots and ring sprites per frame. Decision: five batches (back dots, strokes, petals, front dots, rings) refilled every frame. Consequence: ~5 draw calls; layers are simple functions of state.

## 9. Pure `PlaybackCursor`
Context: the old transport callback mixed sequencing, UI flags and audio. Decision: isolate sequencing in a pure class driven by Tone live and offline. Consequence: playback rules are unit-tested and exports match what is heard.

## 10. Sessions in `localStorage` with validation, no expiry
Context: the old server expired sessions after one day and keyed them by token. Decision: store in the browser, validate on load, quarantine corrupt data, never overwrite data from a newer version, offer JSON download/import. Consequence: private, offline-capable; a user clearing site data loses the session unless they exported it.

## 11. Ids over indexes
Decision: string ids for loops, tracks, notes, sections. Consequence: deleting never renumbers; structures reference loops safely.

## 12. One petal mesh
The four `petalN.obj` files were identical. Decision: ship `petal.obj` once and tint per track kind.
