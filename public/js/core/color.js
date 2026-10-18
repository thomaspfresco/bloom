// @ts-check

/** @typedef {[number, number, number]} RGB 0-255 channels. */

/** Off-white used for all UI text and lines in the original design. */
export const WHITE = /** @type {RGB} */ ([255, 245, 220]);

/** Track palette: blue, pink, yellow, green (BASS, DRUMS, HARMONY, MELODY). */
export const PALETTE = Object.freeze({
  blue: /** @type {RGB} */ ([0, 65, 170]),
  pink: /** @type {RGB} */ ([220, 20, 100]),
  yellow: /** @type {RGB} */ ([250, 160, 25]),
  green: /** @type {RGB} */ ([0, 160, 100]),
});

/** @param {RGB} rgb @param {number} [alpha] 0-1 */
export function css(rgb, alpha = 1) {
  const [r, g, b] = rgb;
  return alpha >= 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;
}

/** @param {RGB} rgb @returns {number} 0xRRGGBB */
export function toHex(rgb) {
  return (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
}
