// @ts-check
// The living shape of one track: 66 points that ease toward a target layout
// (a wavy ribbon across the screen, or a wobbling circle), the line through
// them, and the petals sitting on it for each note.
//
// Port of the particlesX/Y arrays and the draw / drawInDrawer / drawPreview /
// drawInStructure methods of the old `Track`, with the layout and the drawing
// separated so the same bloom can be shown in different places.

import { Matrix4 } from 'three/webgpu';
import { WHITE } from '../../core/color.js';
import { N_STEPS } from '../../core/constants.js';
import { remap, ringDistance } from '../../core/math.js';
import { noise } from '../core/noise.js';
import { petalMatrix } from '../core/petalMath.js';
import { NoteVisual } from './NoteVisual.js';

/** Points per bloom: one per step plus a point at each end. */
export const POINTS = N_STEPS + 2;
/** Points that make up the closed circle (the old code dropped the last). */
const RING = POINTS - 1;

const _m = new Matrix4();

/** Line widths by track index: maxWeightLines / (index + 1), maxWeightLines = 2. */
export const lineWidth = (/** @type {number} */ trackIndex) => 2 / (trackIndex + 1);

/** @typedef {import('../core/BloomScene.js').Frame} Frame */
/** @typedef {import('../../model/Track.js').Track} Track */
/** @typedef {import('../../core/color.js').RGB} RGB */

export class TrackBloom {
  /** @param {{x?: number, y?: number}} [origin] where points start (they ease away from here) */
  constructor({ x = 0, y = 0 } = {}) {
    this.xs = new Float32Array(POINTS).fill(x);
    this.ys = new Float32Array(POINTS).fill(y);
    this.tx = new Float32Array(POINTS);
    this.ty = new Float32Array(POINTS);
    /** direction of each point from the circle centre (radians), for offsetting petals outward */
    this.angles = new Float32Array(POINTS);
    /** @type {Map<string, NoteVisual>} */
    this.notes = new Map();
    /** line brightness 0-1, eased */
    this.opaLine = 1;
    /** petal rotation for the track's icon / studio petal */
    this.iconAng = Math.random() * Math.PI * 2;
    this.iconAngInc = Math.PI / 20;
    this.lastUsed = 0;
  }

  /** Start from another bloom's current shape and note positions (see scene/core/handoff.js). @param {TrackBloom} other */
  copyFrom(other) {
    this.xs.set(other.xs);
    this.ys.set(other.ys);
    for (const [id, v] of other.notes) {
      const mine = this.visual(id);
      mine.x = v.x;
      mine.y = v.y;
    }
  }

  // ---- targets -------------------------------------------------------------

  /**
   * Horizontal wavy ribbon: x follows the grid columns, y wobbles around the
   * middle of the screen with slow noise.
   * @param {Frame} frame @param {{gridX: number, stepX: number, trackIndex: number}} p
   */
  ribbonTargets(frame, { gridX, stepX, trackIndex }) {
    const { width: W, height: H } = frame;
    const frames = frame.t * 0.06; // 60 fps frame counter
    const wobble = (/** @type {number} */ x) => H / 2 + remap(noise.get(x * 0.0005, trackIndex * 0.3, frames * 0.002), 0, 1, -H / 10, H / 10);

    this.tx[0] = 0;
    this.ty[0] = wobble(0);
    for (let i = 1; i < POINTS - 1; i++) {
      const x = gridX + (i - 1) * stepX;
      this.tx[i] = x;
      this.ty[i] = wobble(x);
    }
    this.tx[POINTS - 1] = W;
    this.ty[POINTS - 1] = wobble(W);
  }

  /**
   * Wobbling circle (drawers, previews, structures).
   * @param {{cx: number, cy: number, radius: number, wobble: number, phase: number, zoff: number, seed: number}} p
   *   `wobble` is the noise amplitude as a fraction of the radius
   */
  circleTargets({ cx, cy, radius, wobble, phase, zoff, seed }) {
    let angle = -Math.PI / 2;
    const step = (Math.PI * 2) / POINTS + (Math.PI * 2) / POINTS / POINTS;
    for (let i = 0; i < POINTS; i++) {
      const xoff = remap(Math.cos(angle + phase + seed), -1, 1, 0, 1);
      const yoff = remap(Math.sin(angle + phase + seed), -1, 1, 0, 1);
      const r = remap(noise.get(xoff, yoff, zoff), 0, 1, 0, radius * wobble);
      this.angles[i] = angle;
      this.tx[i] = cx + Math.cos(angle) * (radius + r);
      this.ty[i] = cy + Math.sin(angle) * (radius + r);
      angle -= step;
    }
  }

  /** Close `1/n` of the remaining gap per 60 fps frame (like the original's d/15 and d/6). @param {number} n @param {number} k */
  ease(n, k) {
    const f = 1 - (1 - 1 / n) ** k;
    for (let i = 0; i < POINTS; i++) {
      this.xs[i] += (this.tx[i] - this.xs[i]) * f;
      this.ys[i] += (this.ty[i] - this.ys[i]) * f;
    }
  }

  /** Jump straight to the targets. */
  snap() {
    this.xs.set(this.tx);
    this.ys.set(this.ty);
  }

  // ---- lines ---------------------------------------------------------------

  /**
   * Open ribbon with brightness fading away from the playhead.
   * @param {Frame} frame @param {{trackIndex: number, playing: boolean, step: number, opacity?: number}} p
   */
  strokeRibbon(frame, { trackIndex, playing, step, opacity = 1 }) {
    frame.batches.strokes.polyline(this.xs, this.ys, {
      width: lineWidth(trackIndex),
      rgb: WHITE,
      alpha: (i) => {
        const dif = !playing ? 6 : Math.min(6, Math.abs(step - i));
        return Math.min(1, (this.opaLine * opacity) / Math.max(dif, 1e-3));
      },
      count: POINTS,
    });
  }

  /**
   * Closed circle, optionally dropping every 8th point (drawer thumbnails)
   * and fading around the playhead.
   * @param {Frame} frame
   * @param {{width: number, opacity: number, playing?: boolean, step?: number, fade?: boolean, thin?: boolean, floor?: number}} p
   *   `fade`: brighten the stretch of line near the playhead; `floor`: minimum alpha fraction of `opacity`
   */
  strokeCircle(frame, { width, opacity, playing = false, step = -1, fade = false, thin = false, floor = 0.2 }) {
    /** @type {number[] | null} */
    let order = null;
    if (thin) {
      order = [];
      for (let i = 0; i < RING; i++) if (i % 8 !== 0) order.push(i);
    }
    const count = order ? order.length : RING;
    const at = (/** @type {number} */ j) => (order ? order[j] : j);
    // points are walked in reverse so the line runs the same way the steps do
    const index = (/** @type {number} */ j) => (RING - at(j)) % RING;
    const current = (step - 1 + RING) % RING;

    frame.batches.strokes.polyline(this.xs, this.ys, {
      width, rgb: WHITE, closed: true, count, index,
      alpha: (j) => {
        if (!(fade && playing)) return opacity * (fade ? floor : 1);
        const d = Math.min(6, ringDistance(current, at(j), RING));
        return Math.max(opacity * floor, (opacity * (6 - d)) / 6);
      },
    });
  }

  // ---- notes ---------------------------------------------------------------

  /**
   * @param {string} id note id @param {{x?: number, y?: number}} [spawn] initial position for a new visual
   * @returns {NoteVisual}
   */
  visual(id, spawn) {
    let v = this.notes.get(id);
    if (!v) { v = new NoteVisual(spawn); this.notes.set(id, v); }
    return v;
  }

  /** Forget visuals of notes that no longer exist. @param {Set<string>} alive */
  pruneNotes(alive) {
    for (const id of this.notes.keys()) if (!alive.has(id)) this.notes.delete(id);
  }

  /**
   * Draw one note: petal, "just played" ring and particles.
   * @param {Frame} frame @param {NoteVisual} v @param {RGB} rgb track colour
   * @param {{x: number, y: number, size: number, alpha?: number, z?: number}} p
   */
  drawNote(frame, v, rgb, { x, y, size, alpha = 1, z = 0 }) {
    const { batches, petalSize } = frame;
    const lift = v.boost;
    const r = Math.min(255, rgb[0] + lift);
    const g = Math.min(255, rgb[1] + lift);
    const b = Math.min(255, rgb[2] + lift);

    for (const p of v.particles) batches.front.add(p.x, p.y, p.size, rgb[0], rgb[1], rgb[2], p.opacity);

    petalMatrix(_m, { x, y, z, scale: size / petalSize, rx: v.ang, ry: v.ang });
    batches.petals.add(_m, r, g, b, alpha);

    if (v.ringOpacity > 0) batches.rings.add(x, y, v.ringSize, Math.max(0.75, size / 12), r, g, b, v.ringOpacity);
  }
}
