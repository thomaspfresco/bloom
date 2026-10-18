// @ts-check
// Option tables behind every knob. A knob stores a 0-1 value; the "output" is
// the table entry at round(value * (length-1)). Built with the exact loops of
// the old theory.js so outputs are identical (30 / 43 / 101 entries).

import { DELAY_TIMES, WAVE_TYPES } from './theory.js';

function buildTimeValues() {
  /** @type {number[]} */
  const out = [];
  let t = 0;
  while (Math.round(t * 100) / 100 < 0.1) { t += 0.01; out.push(Math.round(t * 100) / 100); }
  while (Math.round(t * 10) / 10 < 1) { t += 0.1; out.push(Math.round(t * 10) / 10); }
  while (t < 2) { t += 0.25; out.push(t); }
  while (t < 3) { t += 0.25; out.push(t); }
  out.push(4, 5, 10);
  return out;
}

/** Cents, -1200..1200: fine steps of 10 within +-100, otherwise steps of 100. */
function buildPitchValues() {
  /** @type {number[]} */
  const out = [];
  let c = -1200;
  while (c <= 1200) {
    out.push(c);
    c += c >= -100 && c < 100 ? 10 : 100;
  }
  return out;
}

function buildUnitValues() {
  /** @type {number[]} */
  const out = [];
  let v = 0;
  while (v <= 1) { out.push(Math.round(v * 100) / 100); v += 0.01; }
  out.push(1);
  return out;
}

/** @typedef {'wave' | 'time' | 'pitch' | 'unit' | 'delay'} TableKey */

/** @type {Readonly<Record<TableKey, readonly (string|number)[]>>} */
export const TABLES = Object.freeze({
  wave: WAVE_TYPES,
  time: buildTimeValues(),
  pitch: buildPitchValues(),
  unit: buildUnitValues(),
  delay: DELAY_TIMES,
});

/**
 * @param {TableKey} key @param {number} value 0-1
 * @returns {string|number}
 */
export function lookup(key, value) {
  const table = TABLES[key];
  const idx = Math.round(Math.min(1, Math.max(0, value)) * (table.length - 1));
  return table[idx];
}
