// @ts-check
// Factory presets. Ported from the old synths.js; samples are referenced by
// kit name and resolved to URLs in audio/drumKits.js (this file stays pure data).

/**
 * @typedef {object} FxPreset
 * @property {boolean} filterState @property {number} filter
 * @property {boolean} distortionState @property {number} distortion
 * @property {boolean} delayState @property {number[]} delay   [time, feedback, mix]
 * @property {boolean} reverbState @property {number[]} reverb [decay, mix]
 */

/**
 * @typedef {FxPreset & {
 *   name: string,
 *   oscState: boolean[], osc: number[][],   // per oscillator: [wave, pitch, volume]
 *   envState: boolean[], env: number[][],   // per envelope: [attack, decay, sustain, release]
 * }} SynthPreset
 */

/**
 * @typedef {FxPreset & {
 *   name: string, kit: 'subtle' | 'acoustic' | 'electronic',
 *   partState: boolean[], partVol: number[], partPitch: number[],
 * }} DrumPreset
 */

/** @type {readonly SynthPreset[]} */
export const SYNTH_PRESETS = Object.freeze([
  { name: 'BLOOM PLUCK', oscState: [true, true], osc: [[0, 0.5, 0.5], [0.7, 0.5, 0.5]], envState: [true, true], env: [[0, 0.83, 0, 0.45], [0, 0.36, 0, 0]], filterState: true, filter: 0.5, distortionState: false, distortion: 0.5, delayState: true, delay: [0.57, 0.5, 0.15], reverbState: true, reverb: [1, 0.5] },
  { name: 'UGLY BASS', oscState: [true, true], osc: [[0, 0.52, 0.5], [1, 0, 0.35]], envState: [true, true], env: [[0, 0, 1, 0], [0, 0, 1, 0]], filterState: true, filter: 0.45, distortionState: true, distortion: 0.75, delayState: true, delay: [0, 0.2, 0.25], reverbState: false, reverb: [0.5, 0.5] },
  { name: '50s BASS', oscState: [true, true], osc: [[1, 0.87, 0.4], [0.3, 0.5, 0.6]], envState: [true, true], env: [[0, 0.5, 0, 0], [0, 0.7, 0, 0]], filterState: false, filter: 0.5, distortionState: true, distortion: 0.25, delayState: false, delay: [0.5, 0.5, 0.5], reverbState: false, reverb: [0.5, 0.5] },
  { name: 'SUB BASS', oscState: [true, true], osc: [[0, 0.5, 0.55], [0, 0, 0.55]], envState: [true, true], env: [[0, 0, 0.5, 0], [0, 0, 0.5, 0]], filterState: false, filter: 0.5, distortionState: true, distortion: 0.15, delayState: false, delay: [0.5, 0.5, 0.5], reverbState: false, reverb: [0.5, 0.5] },
  { name: 'SLOW PAD', oscState: [true, true], osc: [[0, 0.5, 0.4], [1, 0.53, 0.35]], envState: [true, true], env: [[0.62, 0, 1, 0], [0.62, 0, 1, 0]], filterState: true, filter: 0.5, distortionState: false, distortion: 0.5, delayState: true, delay: [0.8, 0.5, 0.1], reverbState: true, reverb: [0.75, 0.5] },
  { name: 'OLD ORGAN', oscState: [true, true], osc: [[0.35, 0, 0.6], [0.67, 0.48, 0.35]], envState: [true, true], env: [[0, 0.91, 0.15, 0.44], [0, 0.9, 0, 0.44]], filterState: true, filter: 0.35, distortionState: false, distortion: 0.5, delayState: false, delay: [0.5, 0.5, 0.5], reverbState: true, reverb: [0.97, 0.35] },
  { name: 'NOISY RHODES', oscState: [true, true], osc: [[0, 0.5, 0.5], [0, 1, 0.5]], envState: [true, true], env: [[0, 0.15, 0.25, 0], [0, 0.15, 0.2, 0]], filterState: false, filter: 0.5, distortionState: true, distortion: 0.03, delayState: true, delay: [0.12, 0.4, 0.5], reverbState: true, reverb: [0.9, 0.5] },
  { name: 'ANALOG PAD', oscState: [true, true], osc: [[0.2, 0, 0.45], [1, 0.5, 0.4]], envState: [true, true], env: [[0.13, 0.77, 0.5, 0.13], [0.13, 0.77, 0.5, 0.13]], filterState: false, filter: 0.5, distortionState: false, distortion: 0.5, delayState: false, delay: [0.5, 0.5, 0.5], reverbState: false, reverb: [0.5, 0.5] },
].map((p) => Object.freeze(p)));

const ALL_PARTS = [true, true, true, true, true, true, true];
const FX_OFF = { filterState: false, filter: 0.5, distortionState: false, distortion: 0.5, delayState: false, delay: [0.5, 0.5, 0.5], reverbState: false, reverb: [0.5, 0.5] };

/** @type {readonly DrumPreset[]} */
export const DRUM_PRESETS = Object.freeze([
  { name: 'SUBTLE', kit: /** @type {const} */ ('subtle'), partState: ALL_PARTS, partVol: [1, 1, 1, 1, 1, 1, 1], partPitch: [0.5, 0.22, 0.5, 0.5, 0.5, 0.5, 0.5], ...FX_OFF },
  { name: 'ACOUSTIC', kit: /** @type {const} */ ('acoustic'), partState: ALL_PARTS, partVol: [1, 1, 1, 1, 1, 1, 1], partPitch: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], ...FX_OFF },
  { name: 'ELECTRONIC', kit: /** @type {const} */ ('electronic'), partState: ALL_PARTS, partVol: [1, 1, 1, 1, 1, 1, 1], partPitch: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], ...FX_OFF },
].map((p) => Object.freeze(p)));
