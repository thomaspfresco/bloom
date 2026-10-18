// @ts-check
// Pure geometry for the note grid: pointer position <-> (step, row) <-> note.
// A grid has 64 columns (steps) and `nRows` rows counted from the bottom:
// pitched tracks show two octaves (24 rows: 0-11 lower octave, 12-23 upper),
// drum tracks one row per drum part (7 rows).

import { N_STEPS } from '../../core/constants.js';

/**
 * @typedef {{x: number, y: number, w: number, h: number}} GridRect  viewport pixels
 * @typedef {{step: number, row: number}} Cell
 */

/** Rows shown for a track. @param {{isDrums: boolean, info: {nPitches: number}}} track */
export const rowCount = (track) => track.info.nPitches;

/** Pixel size of one step column. @param {GridRect} rect */
export const stepWidth = (rect) => rect.w / N_STEPS;

/** Vertical distance between rows. @param {GridRect} rect @param {number} nRows */
export const rowHeight = (rect, nRows) => rect.h / (nRows - 1);

/** Centre x of a step's column (steps sit on the vertical grid lines). @param {GridRect} rect @param {number} step */
export const stepX = (rect, step) => rect.x + step * stepWidth(rect);

/** y of a row (row 0 is the bottom line). @param {GridRect} rect @param {number} nRows @param {number} row */
export const rowY = (rect, nRows, row) => rect.y + rect.h - row * rowHeight(rect, nRows);

/**
 * Cell under a pointer, rounded to the nearest grid point.
 * `inside` is false when the pointer is outside the playable area (a quarter step/row of slack).
 * @param {GridRect} rect @param {number} nRows @param {number} px @param {number} py
 * @returns {Cell & {inside: boolean}}
 */
export function cellAt(rect, nRows, px, py) {
  const step = Math.round((px - rect.x) / stepWidth(rect));
  const fromBottom = Math.round((rect.y + rect.h - py) / rowHeight(rect, nRows));
  const slack = rowHeight(rect, nRows) / 4;
  const inside = step >= 0 && step < N_STEPS
    && fromBottom >= 0 && fromBottom < nRows
    && py > rect.y - slack && py < rect.y + rect.h + slack;
  return { step, row: fromBottom, inside };
}

/**
 * Row (from the bottom) of a note, or -1 when it is not inside the visible window.
 * @param {{pitch: number, octave: number}} note
 * @param {{isDrums: boolean, octaveWindow: number}} track
 */
export function noteRow(note, track) {
  if (track.isDrums) return note.pitch;
  if (note.octave === track.octaveWindow) return note.pitch;
  if (note.octave === track.octaveWindow + 1) return note.pitch + 12;
  return -1;
}

/** Pitch/octave for a row. @param {number} row @param {{isDrums: boolean, octaveWindow: number}} track */
export function rowToNote(row, track) {
  if (track.isDrums) return { pitch: row, octave: 0 };
  return row >= 12 ? { pitch: row - 12, octave: track.octaveWindow + 1 } : { pitch: row, octave: track.octaveWindow };
}

/**
 * Could every note move by (dStep, dRow) and stay inside the grid?
 * @param {{start: number, duration: number, pitch: number, octave: number}[]} notes
 * @param {{isDrums: boolean, octaveWindow: number, info: {nPitches: number}}} track
 * @param {number} dStep @param {number} dRow
 */
export function canMove(notes, track, dStep, dRow) {
  const nRows = track.info.nPitches;
  return notes.every((n) => {
    const row = noteRow(n, track);
    if (row < 0) return false;
    const newRow = row + dRow;
    return n.start + dStep >= 0 && n.start + dStep + n.duration <= N_STEPS && newRow >= 0 && newRow < nRows;
  });
}

/**
 * Duration of a note being drawn by dragging from `anchor` to `current` (steps).
 * Dragging right or left covers every column from one end to the other, inclusive.
 * @param {number} anchor @param {number} current
 * @returns {{start: number, duration: number}}
 */
export function dragSpan(anchor, current) {
  const start = Math.min(anchor, current);
  return { start, duration: Math.abs(current - anchor) + 1 };
}
