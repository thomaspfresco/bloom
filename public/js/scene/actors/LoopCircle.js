// @ts-check
// A loop drawn as overlapping wobbling circles, one per track, with the notes
// as small petals around each. Used for drawer thumbnails, the hover preview,
// the drag ghost and the sections of a structure.

import { N_STEPS } from '../../core/constants.js';
import { lineWidth, POINTS } from './TrackBloom.js';

/** @typedef {import('../core/BloomScene.js').Frame} Frame */
/** @typedef {import('../../model/Loop.js').Loop} Loop */

/**
 * @typedef {object} CircleConfig
 * @property {number} cx @property {number} cy @property {number} radius
 * @property {number} wobble         noise amplitude as a fraction of the radius
 * @property {{phase: number, zoff: number}} clock  slowly advancing noise offsets
 * @property {number} loopIndex      varies the noise per loop
 * @property {number} [lineScale]    multiplier for the line width (default 1)
 * @property {number} [opacity]      line opacity (default 1)
 * @property {boolean} [thin]        drop every 8th point of the line (small thumbnails)
 * @property {boolean} [fade]        brighten the line around the playhead
 * @property {boolean} playing @property {number} step
 * @property {boolean} stepChanged   the playhead moved since the last frame
 * @property {number} noteSize       petal size in px
 * @property {number} noteAlpha
 * @property {boolean} [react]       notes light up, spin and shed particles when played
 * @property {{x: number, y: number}} origin  where a new shape starts (it eases in from there)
 * @property {number} [easeN]        ease divisor (default 6)
 */

/**
 * @param {Frame} frame @param {import('./BloomPool.js').BloomPool} pool @param {string} key unique per placement
 * @param {Loop} loop @param {CircleConfig} c
 */
export function drawLoopCircle(frame, pool, key, loop, c) {
  const { k } = frame;
  loop.tracks.forEach((track, ti) => {
    const bloom = pool.get(`${key}:${track.id}`, frame.t, c.origin);
    bloom.circleTargets({ cx: c.cx, cy: c.cy, radius: c.radius, wobble: c.wobble, phase: c.clock.phase, zoff: c.clock.zoff, seed: (ti + c.loopIndex) * 2 });
    bloom.ease(c.easeN ?? 6, k);

    bloom.strokeCircle(frame, {
      width: lineWidth(ti) * (c.lineScale ?? 1), opacity: c.opacity ?? 1,
      playing: c.playing, step: c.step, fade: c.fade ?? false, thin: c.thin ?? false,
    });

    const alive = new Set(track.notes.map((n) => n.id));
    bloom.pruneNotes(alive);
    for (const note of track.notes) {
      const idx = Math.min(POINTS - 1, N_STEPS - note.start + 1);
      const v = bloom.visual(note.id, { x: bloom.xs[idx], y: bloom.ys[idx] });
      const angle = bloom.angles[idx];
      // notes bob slightly outward and inward from the line
      const bob = Math.sin(v.ang / 2) * (c.radius / 3.5);
      const x = bloom.xs[idx] + Math.cos(angle) * bob;
      const y = bloom.ys[idx] + Math.sin(angle) * bob;

      if (c.react) {
        if (c.stepChanged && note.start === c.step && !track.muted) v.trigger(c.noteSize);
        if (c.playing && note.start <= c.step && c.step <= note.end) {
          v.hold();
          if (c.step < note.end) v.spawn(x, y, frame.height);
        }
        v.tick(k, frame.height);
      } else {
        v.ang += (Math.PI / 200) * k;
      }
      v.x = x; // remembered so a loop opened from here can unfold from this exact spot
      v.y = y;
      bloom.drawNote(frame, v, track.info.color, { x, y, size: c.noteSize, alpha: c.noteAlpha });
    }
  });
}
