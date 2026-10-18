import test from 'node:test';
import assert from 'node:assert/strict';
import { cellAt, rowY, stepX, noteRow, rowToNote, canMove, dragSpan, stepWidth, rowHeight } from '../../public/js/scene/core/gridMath.js';
import { Track } from '../../public/js/model/Track.js';

const rect = { x: 50, y: 100, w: 640, h: 460 }; // 10 px/step, 20 px/row at 24 rows

test('step and row geometry', () => {
  assert.equal(stepWidth(rect), 10);
  assert.equal(rowHeight(rect, 24), 20);
  assert.equal(stepX(rect, 4), 90);
  assert.equal(rowY(rect, 24, 0), 560); // bottom line
  assert.equal(rowY(rect, 24, 23), 100); // top line
});

test('pointer to cell rounds to the nearest grid point', () => {
  assert.deepEqual(cellAt(rect, 24, 94, 540), { step: 4, row: 1, inside: true });
  assert.deepEqual(cellAt(rect, 24, 50, 560), { step: 0, row: 0, inside: true });
  assert.deepEqual(cellAt(rect, 24, 50 + 63 * 10, 100), { step: 63, row: 23, inside: true });
  assert.equal(cellAt(rect, 24, 10, 300).inside, false, 'left of the grid');
  assert.equal(cellAt(rect, 24, 300, 20).inside, false, 'above the grid');
  assert.equal(cellAt(rect, 24, 50 + 64 * 10, 300).inside, false, 'the closing line is not a step');
});

test('notes map to rows through the octave window', () => {
  const t = new Track('BASS'); t.octaveWindow = 2;
  assert.equal(noteRow({ pitch: 5, octave: 2 }, t), 5);
  assert.equal(noteRow({ pitch: 5, octave: 3 }, t), 17);
  assert.equal(noteRow({ pitch: 5, octave: 4 }, t), -1);
  assert.deepEqual(rowToNote(17, t), { pitch: 5, octave: 3 });
  assert.deepEqual(rowToNote(3, t), { pitch: 3, octave: 2 });

  const d = new Track('DRUMS');
  assert.equal(noteRow({ pitch: 4, octave: 0 }, d), 4);
  assert.deepEqual(rowToNote(6, d), { pitch: 6, octave: 0 });
});

test('moves are blocked at the edges', () => {
  const t = new Track('BASS'); t.octaveWindow = 3;
  const n = { start: 0, duration: 4, pitch: 0, octave: 3 };
  assert.equal(canMove([n], t, -1, 0), false);
  assert.equal(canMove([n], t, 0, -1), false);
  assert.equal(canMove([n], t, 60, 0), true);
  assert.equal(canMove([n], t, 61, 0), false);
  assert.equal(canMove([n], t, 0, 23), true);
  assert.equal(canMove([n], t, 0, 24), false);
  assert.equal(canMove([{ ...n, octave: 9 }], t, 0, 0), false, 'outside the window');
  const d = new Track('DRUMS');
  assert.equal(canMove([{ start: 0, duration: 1, pitch: 6, octave: 0 }], d, 0, 1), false);
});

test('drawing a note by dragging covers every column crossed', () => {
  assert.deepEqual(dragSpan(4, 4), { start: 4, duration: 1 });
  assert.deepEqual(dragSpan(4, 8), { start: 4, duration: 5 });
  assert.deepEqual(dragSpan(8, 4), { start: 4, duration: 5 });
});
