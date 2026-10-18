// @ts-check

import { MAX_LOOPS_PER_STRUCT, MAX_REPEATS, TEMPO, TRANSPOSE } from '../core/constants.js';
import { newId } from '../core/ids.js';
import { clamp } from '../core/math.js';

/**
 * @typedef {object} SectionData
 * @property {string} id
 * @property {string} loopId
 * @property {number} repeats  1..MAX_REPEATS
 */

/**
 * @typedef {object} StructureData
 * @property {string} id
 * @property {string} name
 * @property {number} tempo
 * @property {number} transpose
 * @property {boolean} useTempo       override each loop's tempo with the structure's
 * @property {boolean} useTranspose   apply `transpose` semitones to pitched tracks
 * @property {SectionData[]} sections
 */

/** One slot in a structure: a reference to a loop played `repeats` times. */
export class Section {
  /** @param {{loopId: string, repeats?: number, id?: string}} init */
  constructor({ loopId, repeats = 1, id }) {
    this.id = id ?? newId('s');
    this.loopId = loopId;
    this.repeats = clamp(repeats, 1, MAX_REPEATS);
  }

  /** @returns {SectionData} */
  toJSON() { return { id: this.id, loopId: this.loopId, repeats: this.repeats }; }
}

/**
 * An arrangement: loops in sequence. Sections reference loops by id and always
 * read the loop's current content (the old app kept copies and re-synced them
 * by name whenever the drawer opened).
 */
export class Structure {
  /** @param {{name: string, id?: string}} init */
  constructor({ name, id }) {
    this.id = id ?? newId('x');
    this.name = name;
    /** @type {number} */
    this.tempo = TEMPO.default;
    this.transpose = 0;
    this.useTempo = false;
    this.useTranspose = false;
    /** @type {Section[]} */
    this.sections = [];
  }

  get isEmpty() { return this.sections.length === 0; }
  get isFull() { return this.sections.length >= MAX_LOOPS_PER_STRUCT; }

  /**
   * Insert a loop reference, merging with identical neighbours (old `joinDoubles`).
   * @param {string} loopId @param {number} [index] insert position (default: end)
   * @param {number} [repeats]
   * @returns {Section | null} null when the structure is full
   */
  insertLoop(loopId, index = this.sections.length, repeats = 1) {
    if (this.isFull) return null;
    const section = new Section({ loopId, repeats });
    this.sections.splice(clamp(index, 0, this.sections.length), 0, section);
    this.mergeNeighbours();
    return section;
  }

  /** @param {string} sectionId */
  removeSection(sectionId) {
    const i = this.sections.findIndex((s) => s.id === sectionId);
    if (i < 0) return false;
    this.sections.splice(i, 1);
    this.mergeNeighbours();
    return true;
  }

  /** @param {string} loopId remove every section pointing at a deleted loop */
  removeLoopReferences(loopId) {
    const before = this.sections.length;
    this.sections = this.sections.filter((s) => s.loopId !== loopId);
    if (this.sections.length !== before) this.mergeNeighbours();
    return before !== this.sections.length;
  }

  /** @param {number} from @param {number} to */
  moveSection(from, to) {
    if (from === to || from < 0 || from >= this.sections.length) return;
    const [s] = this.sections.splice(from, 1);
    this.sections.splice(clamp(to, 0, this.sections.length), 0, s);
    this.mergeNeighbours();
  }

  /** Adjacent sections with the same loop collapse into one (repeats add up, capped). */
  mergeNeighbours() {
    /** @type {Section[]} */
    const out = [];
    for (const s of this.sections) {
      const prev = out[out.length - 1];
      if (prev && prev.loopId === s.loopId) prev.repeats = Math.min(MAX_REPEATS, prev.repeats + s.repeats);
      else out.push(s);
    }
    this.sections = out;
  }

  /** @param {string} sectionId @param {number} repeats */
  setRepeats(sectionId, repeats) {
    const s = this.sections.find((x) => x.id === sectionId);
    if (s) s.repeats = clamp(Math.round(repeats), 1, MAX_REPEATS);
  }

  /**
   * Replace the sections with a random arrangement of the given loops: 1-5 sections,
   * each repeated 1-3 times (the dice button).
   * @param {readonly string[]} loopIds @param {import('../core/random.js').Random} random
   */
  randomize(loopIds, random) {
    if (loopIds.length === 0) return;
    const count = Math.min(MAX_LOOPS_PER_STRUCT, Math.max(1, Math.round(random.range(1, MAX_LOOPS_PER_STRUCT + 1))));
    this.sections = [];
    for (let i = 0; i < count; i++) {
      this.sections.push(new Section({ loopId: loopIds[random.int(0, loopIds.length)], repeats: random.int(1, 4) }));
    }
    this.mergeNeighbours();
  }

  /** @param {number} t */
  setTempo(t) { this.tempo = clamp(Math.round(t), TEMPO.min, TEMPO.max); }

  /** @param {number} t */
  setTranspose(t) { this.transpose = clamp(Math.round(t), TRANSPOSE.min, TRANSPOSE.max); }

  /** @returns {StructureData} */
  toJSON() {
    return {
      id: this.id, name: this.name, tempo: this.tempo, transpose: this.transpose,
      useTempo: this.useTempo, useTranspose: this.useTranspose,
      sections: this.sections.map((s) => s.toJSON()),
    };
  }

  /** @param {any} d untrusted @returns {Structure | null} */
  static fromJSON(d) {
    if (!d || typeof d !== 'object' || typeof d.name !== 'string') return null;
    const s = new Structure({ id: typeof d.id === 'string' ? d.id : undefined, name: d.name.slice(0, 64) });
    if (Number.isFinite(d.tempo)) s.setTempo(d.tempo);
    if (Number.isFinite(d.transpose)) s.setTranspose(d.transpose);
    s.useTempo = d.useTempo === true;
    s.useTranspose = d.useTranspose === true;
    if (Array.isArray(d.sections)) {
      for (const sd of d.sections) {
        if (sd && typeof sd.loopId === 'string' && !s.isFull) {
          s.sections.push(new Section({ id: typeof sd.id === 'string' ? sd.id : undefined, loopId: sd.loopId, repeats: Number(sd.repeats) || 1 }));
        }
      }
    }
    return s;
  }
}
