// @ts-check
import { DRUM_LABELS } from '../music/theory.js';
import { Tone } from './tone.js';

/** @typedef {'subtle' | 'acoustic' | 'electronic'} KitName */

/** File name stems in DRUM_LABELS order. */
const STEMS = ['kick', 'snare', 'closedHat', 'openedHat', 'highTom', 'lowTom', 'crash'];

/** @param {KitName} kit @returns {string[]} sample URLs in drum-part order */
export function kitUrls(kit) {
  return STEMS.map((stem) => `/samples/${stem}_${kit}.wav`);
}

export const CLICK_URLS = Object.freeze({ accent: '/samples/mUp.wav', beat: '/samples/m.wav' });

/** @type {Map<KitName, Promise<any[]>>} */
const loaded = new Map();
/** @type {Map<KitName, any[]>} */
const ready = new Map();

/** Buffers of a kit that has already finished loading, else null (needed by offline rendering, which cannot await). @param {KitName} kit */
export function kitIfLoaded(kit) {
  return ready.get(kit) ?? null;
}

/**
 * Load (once) the seven buffers of a kit.
 * @param {KitName} kit @returns {Promise<any[]>} Tone.Buffer[]
 */
export function loadKit(kit) {
  const existing = loaded.get(kit);
  if (existing) return existing;
  const buffers = kitUrls(kit).map((url) => new Tone.Buffer(url));
  /** @type {Promise<any[]>} */
  const p = Tone.loaded().then(() => { ready.set(kit, buffers); return buffers; });
  loaded.set(kit, p);
  p.catch(() => loaded.delete(kit));
  return p;
}

export { DRUM_LABELS };
