// @ts-check
// Declarative parameter / toggle layout per track kind (replaces the nested
// knob arrays built in the old Track constructor).

import { DRUM_LABELS } from '../music/theory.js';

/** @typedef {import('./Parameter.js').ParameterSpec} ParameterSpec */

/** @type {(id: string, group: string, label: string, table: import('./Parameter.js').ParameterSpec['table'], initial: number, unit?: string) => ParameterSpec} */
const spec = (id, group, label, table, initial, unit = '') => ({ id, group, label, table, initial, unit });

/** FX parameters shared by every kind. */
const FX = [
  spec('filter.position', 'FILTER', 'POSITION', 'unit', 0.5),
  spec('dist.amount', 'DIST', 'AMOUNT', 'unit', 0.5),
  spec('delay.time', 'DELAY', 'TIME', 'delay', 0.5),
  spec('delay.feedback', 'DELAY', 'FEEDBACK', 'unit', 0.5),
  spec('delay.mix', 'DELAY', 'DRY/WET', 'unit', 0.5),
  spec('reverb.decay', 'REVERB', 'DECAY', 'time', 0.5, 's'),
  spec('reverb.mix', 'REVERB', 'DRY/WET', 'unit', 0.5),
];

/** Two oscillators (wave/pitch/volume) and two envelopes (ADSR). Defaults match the old constructor. */
const SYNTH = [
  ...[1, 2].flatMap((n) => [
    spec(`osc${n}.wave`, `OSC ${n}`, 'WAVE', 'wave', n === 1 ? 1 : 0),
    spec(`osc${n}.pitch`, `OSC ${n}`, 'PITCH', 'pitch', 0.5, 'st'),
    spec(`osc${n}.volume`, `OSC ${n}`, 'VOLUME', 'unit', 0.5),
    spec(`env${n}.attack`, `ENV ${n}`, 'ATTACK', 'time', 0, 's'),
    spec(`env${n}.decay`, `ENV ${n}`, 'DECAY', 'time', 0.5, 's'),
    spec(`env${n}.sustain`, `ENV ${n}`, 'SUSTAIN', 'unit', 0.5),
    spec(`env${n}.release`, `ENV ${n}`, 'RELEASE', 'time', 0, 's'),
  ]),
  ...FX,
];

const DRUMS = [
  ...DRUM_LABELS.flatMap((label, i) => [
    spec(`part${i}.gain`, label, 'GAIN', 'unit', 1),
    spec(`part${i}.pitch`, label, 'PITCH', 'pitch', 0.5, 'st'),
  ]),
  ...FX,
];

/** Ordered parameter specs per kind. @type {Readonly<Record<'synth'|'drums', readonly ParameterSpec[]>>} */
export const PARAMETER_SPECS = Object.freeze({ synth: SYNTH, drums: DRUMS });

/** Toggle (on/off button) ids per kind with their default state. */
export const TOGGLE_DEFAULTS = Object.freeze({
  synth: Object.freeze(
    /** @type {Record<string, boolean>} */ ({
      osc1: true, osc2: true, env1: true, env2: true, filter: true, dist: false, delay: false, reverb: false,
    }),
  ),
  drums: Object.freeze(
    /** @type {Record<string, boolean>} */ ({
      ...Object.fromEntries(DRUM_LABELS.map((_, i) => [`part${i}`, true])),
      filter: true, dist: false, delay: false, reverb: false,
    }),
  ),
});
