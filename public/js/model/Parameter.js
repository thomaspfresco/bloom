// @ts-check

import { N_STEPS } from '../core/constants.js';
import { clamp } from '../core/math.js';
import { lookup } from '../music/parameterTables.js';

/** @typedef {import('../music/parameterTables.js').TableKey} TableKey */

/**
 * Static description of a parameter (what the knob is). Dynamic state
 * (value, automation) lives on the `Parameter` instance.
 * @typedef {object} ParameterSpec
 * @property {string} id        stable key, e.g. "osc1.wave"
 * @property {string} group     UI grouping, e.g. "OSC 1"
 * @property {string} label     e.g. "WAVE"
 * @property {TableKey} table   option table the 0-1 value indexes
 * @property {string} unit      display suffix ("s", "st", "")
 * @property {number} initial   default 0-1 value
 */

/**
 * @typedef {object} ParameterData
 * @property {string} id
 * @property {number} value
 * @property {boolean} automating
 * @property {number[]} automation  one 0-1 value per step
 */

/** A knob-style parameter, optionally automated per step. */
export class Parameter {
  /** @param {ParameterSpec} spec */
  constructor(spec) {
    this.spec = spec;
    this.value = spec.initial;
    this.automating = false;
    /** @type {number[]} */
    this.automation = new Array(N_STEPS).fill(0.5);
  }

  get id() { return this.spec.id; }
  get label() { return this.spec.label; }
  get group() { return this.spec.group; }
  get unit() { return this.spec.unit; }

  /** @param {number} v 0-1 */
  set(v) {
    this.value = clamp(Math.round(v * 100) / 100, 0, 1);
  }

  /** Value to use at a given step: automated curve or the static knob. */
  valueAt(step = -1) {
    return this.automating && step >= 0 && step < this.automation.length ? this.automation[step] : this.value;
  }

  /** Raw table entry (e.g. 'sine', 0.25, -1200). @param {number} [step] */
  output(step = -1) {
    return lookup(this.spec.table, this.valueAt(step));
  }

  /** Human-readable text: "SINE", "0.5s", "-12st", "0.37". @param {number} [step] */
  format(step = -1) {
    const out = this.output(step);
    if (typeof out === 'string') return out.toUpperCase();
    if (this.spec.unit === 'st') return `${out / 100}${this.spec.unit}`;
    return `${out}${this.spec.unit}`;
  }

  /** @param {number} step @param {number} v */
  setAutomation(step, v) {
    if (step < 0 || step >= this.automation.length) return;
    this.automation[step] = clamp(v, 0, 1);
    this.automating = true;
  }

  clearAutomation() {
    this.automating = false;
    this.automation.fill(0.5);
  }

  /** @returns {ParameterData} */
  toJSON() {
    return {
      id: this.spec.id,
      value: this.value,
      automating: this.automating,
      automation: this.automation.slice(),
    };
  }

  /** Overlay persisted state; tolerant of missing/invalid fields. @param {Partial<ParameterData>} data */
  restore(data) {
    if (typeof data.value === 'number' && Number.isFinite(data.value)) this.value = clamp(data.value, 0, 1);
    this.automating = data.automating === true;
    if (Array.isArray(data.automation)) {
      for (let i = 0; i < this.automation.length; i++) {
        const v = data.automation[i];
        if (typeof v === 'number' && Number.isFinite(v)) this.automation[i] = clamp(v, 0, 1);
      }
    }
  }

  clone() {
    const p = new Parameter(this.spec);
    p.restore(this.toJSON());
    return p;
  }
}
