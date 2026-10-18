// @ts-check

/**
 * Small seedable PRNG (mulberry32). All generative code takes a `Random` so
 * tests can pin behaviour; production uses `Random.shared`, seeded from crypto.
 */
export class Random {
  /** Process-wide instance for production code. */
  static shared = new Random();

  /** @param {number} [seed] 32-bit integer; omit for a random seed. */
  constructor(seed) {
    this.state = (seed ?? Random.entropy()) >>> 0;
  }

  static entropy() {
    if (globalThis.crypto?.getRandomValues) {
      return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
    }
    return Math.floor(Math.random() * 2 ** 32);
  }

  /** Uniform float in [0, 1). */
  float() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [lo, hi). @param {number} lo @param {number} hi */
  range(lo, hi) {
    return lo + this.float() * (hi - lo);
  }

  /** Integer in [lo, hi), like `numpy.random.randint(lo, hi)`. @param {number} lo @param {number} hi */
  int(lo, hi) {
    return lo + Math.floor(this.float() * (hi - lo));
  }

  /** Pick one element. @template T @param {readonly T[]} items @returns {T} */
  pick(items) {
    return items[this.int(0, items.length)];
  }

  /** True with probability p. @param {number} p */
  chance(p) {
    return this.float() < p;
  }

  /**
   * Sample an index from (possibly unnormalised) weights, like `numpy.random.choice(p=)`.
   * @param {ArrayLike<number>} weights
   */
  weighted(weights) {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i];
    let r = this.float() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return weights.length - 1;
  }

  /** @param {number} [seed] */
  static create(seed) {
    return new Random(seed);
  }
}
