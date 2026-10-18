# UI components

Everything under `public/js/ui/`. Layout uses the `vh`-based tokens in `public/css/tokens.css` to keep the original proportions; styles are in `public/css/components.css` (shared atoms) and `compose.css` (views).

## Principles

- A component is a class extending `Component` that **builds its DOM in its constructor** (so every field has a definite type), implements `update()` to re-render from state, and registers listeners through `this.listen(emitter, event, fn)` / `this.on(target, type, fn)` so `destroy()` removes them.
- Components read the `Session` and subscribe to its `change` events; they change data through `Actions` or session methods, and call `session.touch(scope, id)` after editing a loop/structure in place (autosave listens to it).
- Transient state (open drawer, selected track, view, playhead, hover, selection, search text) lives in `state/UiState.js` (`ui.s.*`, `ui.set({...})`), never in the session.
- Interaction is DOM events (Pointer Events with capture for drags). The canvas never receives input.
- Every component receives the same `UiContext` (`context.js`): `session, ui, engine, generator, actions, anchors, toast, menus, notes, generate, playInput, drag, record`.

## Map

| Piece | File | Notes |
|---|---|---|
| Composition root | `App.js` | builds session, storage, scene, audio, controllers, components; wires engine events into `ui.s` |
| Operations with side effects | `Actions.js` | tabs, create/duplicate/delete, playback, export, import/clear |
| Top bar and tabs | `components/TopBar.js` | BLOOM, tabs, session menu (right-click BLOOM), tab menus |
| Home | `components/HomeView.js` | rotating Oblique Strategy |
| Menus / dialogs | `components/MenuHost.js` | one dark layer: option lists (up/down), confirm, prompt, about; arrow keys, Escape, focus restore |
| Toast | `components/Toast.js` | the top-right message log |
| Drawers | `components/Drawers.js`, `Drawer.js` | edge zones, fisheye list, search, hover preview, drag out |
| Loop view | `components/LoopView.js` | hosts: `GridEditor`, `AutomationView`, `StudioView`, `TimeBar`, `ControlsBar`, `TrackBar`, `GenerateOverlay` |
| Grid | `components/GridEditor.js` | pointer editing of notes; dotted CSS grid |
| Studio | `components/StudioView.js`, `Knob.js`, `Toggle.js` | CSS grid for the boxes, knobs and toggles placed with the original formulas (`--fx`, `--ay`); level meters never rise above the fader |
| Automation | `components/AutomationView.js` | SVG curve + dots, drag to draw (interpolates fast drags) |
| Controls | `components/ControlsBar.js`, `Scroller.js` | tempo, click, record, octave / preset / parameter scroller, view switch |
| Tracks | `components/TrackBar.js` | track icons, "+" and track menus |
| Time bar | `components/TimeBar.js` | ruler, click to start from a step |
| New track flow | `components/GenerateOverlay.js` + `controllers/GenerateController.js` | modes, 2x2 suggestions with preview, record screen |
| Structure | `components/StructView.js` | sections, repeats, reorder, drop slot, tempo/transpose, dice |
| Busy overlay | `components/Busy.js` | shown while `ui.s.busy` |
| Keyboard | `controllers/Keyboard.js` | Space, Backspace/Delete, note keys, Z/X octave, arrows, Escape |
| Playing / recording notes | `controllers/PlayInput.js` | computer + MIDI keyboards, records into the track while playing |
| Note selection and edits | `controllers/NoteEditing.js` | select, delete, resize |
| Dragging from drawers | `controllers/DragController.js` | events consumed by `StructView` |
| Microphone take | `controllers/RecordController.js` | open mic, count-in, record, transcribe |

## Accessibility

Interactive elements are real `<button>`s or have roles (`slider`, `spinbutton`, `option`, `application` for the grid); menus and dialogs trap Escape/arrow keys and restore focus; the drawers can be opened by focusing their invisible edge buttons; colours are never the only cue (labels, `aria-pressed`). The canvas is `aria-hidden`.

## Fidelity rules

- Controls act on `pointerdown` (the original polled `mouseIsPressed`); use `onPointerdown`, not `onClick`.
- Update keyed DOM in place (see `TopBar`, `TrackBar`); avoid `replaceChildren` on every session change, it restarts animations and blinks.
- Screen changes go through `Fades` (`controllers/Fades.js`), which `Blackouts` renders as black layers fading out over 425 ms.
- Do not add UI that the original does not have; list intentional differences in `PORT_MAP.md`.
- Instant states (hover, on/off, selection) have no CSS transition; only the original's explicit ramps do (blackouts 425 ms, plus 213 ms, scroller arrows and toast 283 ms, menu 333 ms). Reference values live in `PORT_MAP.md`.
- The element a menu belongs to (a track icon, a struct section) stays above the dark layer: pass `keep` (a screen rectangle) to `MenuHost.open`.
