// @ts-check
// The sequencing logic, with no audio dependency: a cursor that, on each call
// to `advance()`, moves one 16th step forward and reports what should happen.
//
// The live `Sequencer` (Tone.Transport) and the offline renderer both drive the
// same cursor, so playback and exported audio cannot drift apart. This is the
// logic of the old `Tone.Transport.scheduleRepeat` callback in synths.js.

import { transposeNote } from '../../music/theory.js';

/** @typedef {import('../../model/Loop.js').Loop} Loop */
/** @typedef {import('../../model/Track.js').Track} Track */
/** @typedef {import('../../model/Structure.js').Structure} Structure */
/** @typedef {import('../../model/Note.js').Note} Note */

/**
 * @typedef {object} LoopPlan
 * @property {'loop'} type
 * @property {Loop} loop
 * @property {() => readonly Track[]} [tracks]  tracks to sound; default `loop.tracks` (lets previews swap tracks live)
 * @property {boolean} [finite]                 stop after one pass (offline export) instead of looping
 * @property {boolean} [click]                  override `loop.click` (e.g. silence it in drawer previews)
 */

/**
 * @typedef {object} StructPlan
 * @property {'struct'} type
 * @property {Structure} struct
 * @property {(loopId: string) => Loop | null} resolveLoop
 * @property {boolean} [finite]
 */

/** @typedef {LoopPlan | StructPlan} PlaybackPlan */

/**
 * One note event, already transposed.
 * @typedef {object} NoteEvent
 * @property {Track} track @property {Note} note
 * @property {number} pitch @property {number} octave   after transposition
 */

/**
 * What happens on one step.
 * @typedef {object} Tick
 * @property {Loop} loop              loop sounding on this step
 * @property {number} step            0..63
 * @property {number} sectionIndex    structure section (0 for plain loops)
 * @property {number} repeat          0-based repeat within the section
 * @property {boolean} wrapped        loop boundary crossed: release every held note first
 * @property {number} bpm
 * @property {'accent' | 'beat' | null} click
 * @property {readonly Track[]} tracks tracks to apply parameters for (unmuted)
 * @property {NoteEvent[]} on
 * @property {NoteEvent[]} off
 * @property {boolean} done           finite plans only: no more steps after this tick
 */

export class PlaybackCursor {
  /** @param {PlaybackPlan} plan */
  constructor(plan) {
    this.plan = plan;
    this.step = -1;
    this.sectionIndex = 0;
    this.repeat = 0;
    this.finished = false;
  }

  /** Reposition so the next `advance()` lands on `step`. @param {number} step */
  seek(step) { this.step = step - 1; }

  /** @returns {Loop | null} the loop currently sounding */
  currentLoop() {
    if (this.plan.type === 'loop') return this.plan.loop;
    const section = this.plan.struct.sections[this.sectionIndex];
    return section ? this.plan.resolveLoop(section.loopId) : null;
  }

  /** Advance one step. Returns null when there is nothing (left) to play. @returns {Tick | null} */
  advance() {
    if (this.finished) return null;
    const plan = this.plan;
    if (plan.type === 'struct' && plan.struct.sections.length === 0) return null;

    let loop = this.currentLoop();
    if (!loop) return null;

    let wrapped = false;
    let done = false;

    if (this.step >= loop.nSteps - 1) {
      wrapped = true;
      this.step = 0;

      if (plan.type === 'loop') {
        if (plan.finite) { this.finished = true; return null; }
      } else {
        const section = plan.struct.sections[this.sectionIndex];
        if (this.repeat >= section.repeats - 1) {
          this.repeat = 0;
          if (this.sectionIndex >= plan.struct.sections.length - 1) {
            if (plan.finite) { this.finished = true; return null; }
            this.sectionIndex = 0;
          } else {
            this.sectionIndex++;
          }
          loop = this.currentLoop();
          if (!loop) return null;
        } else {
          this.repeat++;
        }
      }
    } else {
      this.step++;
    }

    const step = this.step;

    // is this the very last step of a finite plan?
    if (plan.finite && step === loop.nSteps - 1) {
      if (plan.type === 'loop') done = true;
      else {
        const last = plan.struct.sections.length - 1;
        done = this.sectionIndex === last && this.repeat >= plan.struct.sections[last].repeats - 1;
      }
    }

    const bpm = plan.type === 'struct' && plan.struct.useTempo ? plan.struct.tempo : loop.tempo;
    const semitones = plan.type === 'struct' && plan.struct.useTranspose ? plan.struct.transpose : 0;

    const clickOn = plan.type === 'loop' ? (plan.click ?? loop.click) : false;
    /** @type {Tick['click']} */
    let click = null;
    if (clickOn) click = step % 16 === 0 ? 'accent' : step % 4 === 0 ? 'beat' : null;

    const all = plan.type === 'loop' && plan.tracks ? plan.tracks() : loop.tracks;
    const tracks = all.filter((t) => !t.muted);

    /** @type {NoteEvent[]} */ const on = [];
    /** @type {NoteEvent[]} */ const off = [];
    for (const track of tracks) {
      for (const note of track.notes) {
        if (note.start !== step && note.end !== step) continue;
        const shifted = track.isDrums || semitones === 0
          ? { pitch: note.pitch, octave: note.octave }
          : transposeNote(note.pitch, note.octave, semitones);
        const ev = { track, note, pitch: shifted.pitch, octave: shifted.octave };
        if (note.start === step) on.push(ev);
        else if (!track.isDrums) off.push(ev); // drums are one-shots
      }
    }

    return { loop, step, sectionIndex: this.sectionIndex, repeat: this.repeat, wrapped, bpm, click, tracks, on, off, done };
  }
}
