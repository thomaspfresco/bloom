// @ts-check
// Converter for sessions saved by the old p5 app (bloomServer `log.bin`, decoded
// to JSON). Old data identified loops/tracks by array index and stored lists as
// index-keyed objects; this maps it onto the id-based model.

import { SESSION_VERSION } from '../core/constants.js';
import { newId } from '../core/ids.js';
import { PARAMETER_SPECS } from '../model/parameterSpecs.js';
import { isTrackKind } from '../music/trackKinds.js';

/** @param {any} v @returns {any[]} index-keyed object or array -> array, in index order */
const list = (v) => {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    return Object.keys(v).sort((a, b) => Number(a) - Number(b)).map((k) => v[k]);
  }
  return [];
};

/** @param {any} data @returns {boolean} true when `data` looks like the old format */
export function isLegacySession(data) {
  if (!data || typeof data !== 'object' || 'version' in data) return false;
  const loops = list(data.loops);
  return loops.length === 0 ? 'loops' in data && !Array.isArray(data.loops) : 'clickState' in loops[0] || 'tracks' in loops[0];
}

/**
 * @param {any} old @returns {import('../model/Session.js').SessionData}
 */
export function convertLegacySession(old) {
  /** @type {string[]} old loop index -> new id */
  const loopIds = [];

  const loops = list(old.loops).map((ol, i) => {
    const id = newId('l');
    loopIds[i] = id;
    const tracks = list(ol.tracks)
      .filter((ot) => isTrackKind(ot?.name))
      .map((ot) => convertTrack(ot));
    return {
      id,
      name: String(ol.name ?? `myLoop${i + 1}`),
      tempo: Number(ol.tempo) || 120,
      click: ol.clickState === true,
      record: false,
      tracks,
    };
  });

  const structs = list(old.structs).map((os, i) => ({
    id: newId('x'),
    name: String(os.name ?? `myStruct${i + 1}`),
    tempo: Number(os.tempo) || 120,
    transpose: Number(os.transpose) || 0,
    useTempo: os.tempoButtonState === true,
    useTranspose: os.transposeButtonState === true,
    sections: list(os.sequence)
      .filter((sec) => loopIds[Number(sec.loopId)] !== undefined)
      .map((sec) => ({ id: newId('s'), loopId: loopIds[Number(sec.loopId)], repeats: Number(sec.repeats) || 1 })),
  }));

  const structIds = structs.map((s) => s.id);
  const tabs = list(old.tabs)
    .map((t) => (t.type === 'loop' ? { type: /** @type {const} */ ('loop'), id: loopIds[Number(t.id)] } : { type: /** @type {const} */ ('struct'), id: structIds[Number(t.id)] }))
    .filter((t) => typeof t.id === 'string');

  return { version: SESSION_VERSION, savedAt: new Date().toISOString(), loops, structs, tabs, active: null };
}

/** @param {any} ot */
function convertTrack(ot) {
  const kind = ot.name;
  const layout = kind === 'DRUMS' ? 'drums' : 'synth';
  const specs = PARAMETER_SPECS[layout];
  const knobs = list(ot.knobs);

  const params = specs.map((spec, k) => {
    const knob = knobs[k] ?? {};
    return {
      id: spec.id,
      value: Number.isFinite(knob.value) ? knob.value : spec.initial,
      automating: knob.automating === true,
      automation: Array.isArray(knob.automation) ? knob.automation : list(knob.automation),
    };
  });

  /** @type {Record<string, boolean>} */
  const toggles = {
    filter: ot.filterButtonState === true,
    dist: ot.distButtonState === true,
    delay: ot.dlyButtonState === true,
    reverb: ot.revButtonState === true,
  };
  if (kind === 'DRUMS') {
    list(ot.drumButtons).forEach((b, i) => { toggles[`part${i}`] = b?.state === true; });
  } else {
    list(ot.oscButtons).forEach((b, i) => { toggles[`osc${i + 1}`] = b?.state === true; });
    list(ot.envButtons).forEach((b, i) => { toggles[`env${i + 1}`] = b?.state === true; });
  }

  return {
    id: newId('t'),
    kind,
    muted: ot.muted === true,
    gain: Number.isFinite(ot.gain) ? ot.gain : 1,
    preset: Number(ot.presetScrollValue) || 0,
    presetChanged: ot.presetChanged === true,
    octaveWindow: Number(ot.octaveScrollValue) || 0,
    toggles,
    params,
    notes: list(ot.notes).map((n) => ({
      id: newId('n'), pitch: Number(n.pitch), octave: Number(n.octave), start: Number(n.start), duration: Number(n.duration),
    })),
  };
}
