// @ts-check
// Perlin noise with p5.js's algorithm (4 octaves, 0.5 falloff, cosine
// interpolation) so the organic motion matches the original sketches.

import { Random } from '../../core/random.js';

const YWRAPB = 4;
const YWRAP = 1 << YWRAPB;
const ZWRAPB = 8;
const ZWRAP = 1 << ZWRAPB;
const SIZE = 4095;
const OCTAVES = 4;
const FALLOFF = 0.5;

const cosInterp = (/** @type {number} */ i) => 0.5 * (1.0 - Math.cos(i * Math.PI));

export class Noise {
  /** @param {number} [seed] */
  constructor(seed) {
    const rng = new Random(seed);
    this.table = new Float32Array(SIZE + 1);
    for (let i = 0; i <= SIZE; i++) this.table[i] = rng.float();
  }

  /** 0..1 noise at (x, y, z). @param {number} x @param {number} [y] @param {number} [z] */
  get(x, y = 0, z = 0) {
    const t = this.table;
    if (x < 0) x = -x;
    if (y < 0) y = -y;
    if (z < 0) z = -z;

    let xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    let xf = x - xi, yf = y - yi, zf = z - zi;
    let r = 0;
    let ampl = 0.5;

    for (let o = 0; o < OCTAVES; o++) {
      let of = xi + (yi << YWRAPB) + (zi << ZWRAPB);
      const rxf = cosInterp(xf);
      const ryf = cosInterp(yf);

      let n1 = t[of & SIZE];
      n1 += rxf * (t[(of + 1) & SIZE] - n1);
      let n2 = t[(of + YWRAP) & SIZE];
      n2 += rxf * (t[(of + YWRAP + 1) & SIZE] - n2);
      n1 += ryf * (n2 - n1);

      of += ZWRAP;
      n2 = t[of & SIZE];
      n2 += rxf * (t[(of + 1) & SIZE] - n2);
      const n3 = t[(of + YWRAP) & SIZE] + rxf * (t[(of + YWRAP + 1) & SIZE] - t[(of + YWRAP) & SIZE]);
      n2 += ryf * (n3 - n2);

      n1 += cosInterp(zf) * (n2 - n1);
      r += n1 * ampl;
      ampl *= FALLOFF;

      xi <<= 1; xf *= 2;
      yi <<= 1; yf *= 2;
      zi <<= 1; zf *= 2;
      if (xf >= 1) { xi++; xf--; }
      if (yf >= 1) { yi++; yf--; }
      if (zf >= 1) { zi++; zf--; }
    }
    return r;
  }
}

/** Shared instance for visuals. */
export const noise = new Noise();
