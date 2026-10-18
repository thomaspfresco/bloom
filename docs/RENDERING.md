# Rendering

## One canvas behind the page

`templates/base.html` places `<canvas id="scene">` as the first element of `<body>`; `base.css` makes it `position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 0; pointer-events: none`. `#app` (z-index 1) holds all HTML. The canvas draws only petals, track ribbons and circles, particles and rings. Text, buttons, grids, menus are HTML.

## three.js setup (`public/js/scene/core`)

- `renderer.js`: `WebGPURenderer` from `three/webgpu` on that canvas (antialiasing, opaque black clear). three.js falls back to WebGL2 when WebGPU is unavailable; `?gl=1` forces that. `BloomScene.backend` reports which.
- `BloomScene.js`: orthographic camera with `left=0, right=W, top=0, bottom=H`, so **scene units are CSS pixels and +y points down** (same as the DOM and the old p5 sketch). Handles resize and DPR (max 2), runs the animation loop, calls each layer's `update(frame)`.
  - `frame = {t, dt, k, width, height, batches, overlay, dim, petalSize}`. `k` is dt in 60 fps frames: the original animation increments were per frame, so layers multiply by `k` (and ease with `1 - (1 - 1/n)^k`) and look the same at 120 Hz.
- `noise.js`: Perlin noise with p5's algorithm (4 octaves, 0.5 falloff) so motion matches.
- `petalAsset.js`, `petalMath.js`: loads `public/meshes/petal.obj` and composes p5-style transforms (`translate · scale · rotateX · rotateY · rotateZ`). Sizes are `target / petalSize` as in the original.
- `anchors.js`: the DOM-to-scene bridge (below). `gridMath.js`: pure grid geometry shared with the UI. `types.js`: `SceneContext`.

## Batches (`scene/batches`)

Two sets of five instanced/dynamic meshes, refilled every frame:

| Batch | Draws |
|---|---|
| `CircleBatch` (back) | background dots |
| `StrokeBatch` | thick polylines as CPU-built triangle strips with per-vertex alpha (WebGPU has no line width) |
| `PetalBatch` | every petal: per-instance matrix and rgba |
| `CircleBatch` (front) | note particles |
| `RingBatch` | stroked circles ("note played" ring), cut in the fragment shader |

Order: base set (`frame.batches`) -> a black quad whose opacity is `frame.dim.value` -> overlay set (`frame.overlay`). Drawers draw into the overlay and raise `dim`, so their blooms stay bright over a darkened scene (a DOM scrim would also darken them, because the canvas sits behind the DOM). Materials are `MeshBasicNodeMaterial` with TSL colour nodes reading per-instance attributes; `side: DoubleSide` everywhere because the flipped camera reverses triangle winding. No depth test: order is the table above, then insertion order. Overlay buffers are 4x larger (50 loops x 4 tracks of circles).

## Actors and layers

| File | Role |
|---|---|
| `actors/TrackBloom.js` | 66 points easing toward a layout (`ribbonTargets` across the screen, `circleTargets` wobbling circle), `strokeRibbon` / `strokeCircle`, per-note visuals, `drawNote` |
| `actors/NoteVisual.js` | visual-only note state: eased position, spin, brightness, ring, particles (never saved) |
| `actors/LoopCircle.js` | a whole loop drawn as circles (drawer thumbnail, preview, ghost, structure section) |
| `actors/BloomPool.js` | keeps blooms between frames, drops idle ones |
| `layers/Backdrop.js` | 100 drifting dots (noise sampled on a circle, loops every 6 s) |
| `layers/PetalFlow.js` | home-screen petals; fades out when a tab is open |
| `layers/LoopLayer.js` | open loop: ribbons + note petals (overview), notes on the grid (selected track), icons, studio petal |
| `layers/DrawerLayer.js` | drawer blooms, hover preview, drag ghost, dimming |
| `layers/StructLayer.js` | structure sections |

Layers read `session`, the transient UI state (`ui.s`: selected track, view, playhead, hover...) and anchor rectangles. They never mutate either.

## DOM <-> scene geometry

UI components register elements with `Anchors` (`anchors.set(name, el)`); layers call `anchors.rect(name)` each frame, so petals sit exactly where the HTML puts things, including CSS transforms and animations. Names in use:

| Anchor | Element | Used by |
|---|---|---|
| `grid` | `.grid-frame` (grid / ribbon geometry) | LoopLayer |
| `trackIcon:<trackId>` | `.track-petal` | LoopLayer |
| `studioPetal` | visualiser box in the studio | LoopLayer |
| `drawerItem:<id>:<k>` | `.drawer-bloom` | DrawerLayer |
| `drawerPreview:<k>` | `.drawer-preview-bloom` | DrawerLayer |
| `dragGhost` | `.drag-ghost` | DrawerLayer |
| `section:<sectionId>` | `.section-bloom` | StructLayer |

The original laid everything out from window height `H`; `tokens.css` keeps those proportions so CSS and scene agree:

| Quantity | Original | CSS token |
|---|---|---|
| grid left / width | `H/20`, `W - H/10` | `--grid-x: 5vh`, `--grid-w: 100vw - 10vh` |
| grid top / height | `≈ 0.102 H`, `≈ 0.7005 H` | `--grid-y: 10.2vh`, `--grid-h: 70.05vh` |
| track icon / margin | `H/15`, `H/30` | `--icon`, `--margin` |

## Performance notes

- ~5 draw calls per set per frame; 60 fps measured with 50 loops open in the drawer (67k stroke vertices, 6.4k petals).
- All buffers are preallocated; nothing is allocated per frame except short-lived particle objects.
