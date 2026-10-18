// @ts-check

/** @param {number} v @param {number} lo @param {number} hi */
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** @param {number} a @param {number} b @param {number} t */
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * p5-style map(): linearly remap `v` from [inLo,inHi] to [outLo,outHi] (unclamped).
 * @param {number} v @param {number} inLo @param {number} inHi @param {number} outLo @param {number} outHi
 */
export const remap = (v, inLo, inHi, outLo, outHi) =>
  outLo + ((v - inLo) * (outHi - outLo)) / (inHi - inLo);

/** Wrap-around distance between two indices on a ring of `size`. */
export const ringDistance = (/** @type {number} */ a, /** @type {number} */ b, /** @type {number} */ size) => {
  const d = Math.abs(a - b) % size;
  return Math.min(d, size - d);
};

export const TWO_PI = Math.PI * 2;

/** Round half to even, like Python 3's round(); Math.round rounds .5 up. */
export function roundHalfEven(/** @type {number} */ x) {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}
