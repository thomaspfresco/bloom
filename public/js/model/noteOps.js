// @ts-check
// Pure operations on a note list. Replaces `Track.ajustNotes` from the old app.

import { N_STEPS } from '../core/constants.js';
import { Note } from './Note.js';

/**
 * Make room for `incoming` by cutting every overlapping note of the same pitch
 * and octave. `incoming` itself is not added or modified.
 *
 * Differences from the old `ajustNotes`, which produced bad data in two cases:
 *  - a note ending exactly at the incoming note's end no longer leaves a
 *    zero-length remainder;
 *  - a note whose tail overlaps the incoming note is only trimmed (the old code
 *    also created a note with a negative duration).
 *
 * @param {Note[]} notes mutated in place
 * @param {Note} incoming
 * @returns {Note[]} the same array
 */
export function makeRoomFor(notes, incoming) {
  const result = [];
  /** @type {Note[]} */
  const additions = [];

  for (const other of notes) {
    if (other === incoming || !other.samePitch(incoming) || other.start >= incoming.end || other.end <= incoming.start) {
      result.push(other);
      continue;
    }
    const keepsLeft = other.start < incoming.start;
    const keepsRight = other.end > incoming.end;

    if (keepsLeft) {
      const rightEnd = other.end;
      other.duration = incoming.start - other.start;
      result.push(other);
      if (keepsRight) {
        additions.push(new Note({ pitch: other.pitch, octave: other.octave, start: incoming.end, duration: rightEnd - incoming.end }));
      }
    } else if (keepsRight) {
      other.duration = other.end - incoming.end;
      other.start = incoming.end;
      result.push(other);
    }
    // else: fully covered, drop it
  }

  notes.length = 0;
  notes.push(...result, ...additions);
  return notes;
}

/**
 * Add a note, cutting whatever it overlaps.
 * @param {Note[]} notes @param {Note} note
 */
export function addNote(notes, note) {
  makeRoomFor(notes, note);
  notes.push(note);
  return note;
}

/**
 * Resize a note to `duration` steps within the loop, then resolve overlaps.
 * @param {Note[]} notes @param {Note} note @param {number} duration
 */
export function resizeNote(notes, note, duration) {
  note.duration = Math.max(1, Math.min(duration, N_STEPS - note.start));
  makeRoomFor(notes, note);
}

/** @param {Note[]} notes @param {number} pitch @param {number} octave @param {number} step */
export function findNoteAt(notes, pitch, octave, step) {
  return notes.find((n) => n.pitch === pitch && n.octave === octave && n.covers(step)) ?? null;
}

/** @param {Note[]} notes @param {Set<string>} ids */
export function removeNotes(notes, ids) {
  for (let i = notes.length - 1; i >= 0; i--) if (ids.has(notes[i].id)) notes.splice(i, 1);
}
