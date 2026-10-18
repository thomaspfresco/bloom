// @ts-check
// The field of ~100 tiny drifting dots behind everything (the p5 `Particle` class).

import { TWO_PI, remap } from '../../core/math.js';
import { Random } from '../../core/random.js';
import { noise } from '../core/noise.js';

const COUNT = 100;
const PERIOD_FRAMES = 360; // the loop repeats every 6 s at 60 fps

/**
 * A value that wanders smoothly and returns to where it started after one
 * revolution of `angle` (noise sampled on a circle in noise space).
 * @param {number} diameter @param {Random} rng
 */
function noiseLoop(diameter, rng) {
  const cx = rng.range(0, 1000);
  const cy = rng.range(0, 1000);
  return (/** @type {number} */ angle) => {
    const xoff = remap(Math.cos(angle), -1, 1, cx, cx + diameter);
    const yoff = remap(Math.sin(angle), -1, 1, cy, cy + diameter);
    return noise.get(xoff, yoff, Math.sin(angle) * 0.0001); // 0-1
  };
}

export class Backdrop {
  /** @param {Random} [rng] */
  constructor(rng = Random.shared) {
    this.counter = 0;
    this.dots = Array.from({ length: COUNT }, () => ({
      x: noiseLoop(0.05, rng), y: noiseLoop(0.05, rng),
      r: noiseLoop(0.5, rng), g: noiseLoop(0.5, rng), b: noiseLoop(0.5, rng),
      d: noiseLoop(0.5, rng), a: noiseLoop(1, rng),
    }));
  }

  /** @param {import('../core/BloomScene.js').Frame} frame */
  update({ batches, width, height, k }) {
    const angle = ((this.counter % PERIOD_FRAMES) / PERIOD_FRAMES) * TWO_PI;
    this.counter += k;
    for (const dot of this.dots) {
      batches.back.add(
        remap(dot.x(angle), 0, 1, -width, width * 2),
        remap(dot.y(angle), 0, 1, -height, height * 2),
        remap(dot.d(angle), 0, 1, 1, 10) / 2,
        dot.r(angle) * 255, dot.g(angle) * 255, dot.b(angle) * 255,
        (remap(dot.a(angle), 0, 1, 5, 200) * 0.75) / 255,
      );
    }
  }
}
