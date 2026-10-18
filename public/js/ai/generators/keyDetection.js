// @ts-check
import { MAJOR_SCALES } from '../../music/scales.js';

/**
 * Most likely major key of the notes on the given tracks.
 *
 * Port of `punctuateKey`: +2 when a note is the tonic, +1 when it is in the
 * scale. (The original also added +3 to every key whenever the track had notes,
 * because it compared a dict against ints; that is a uniform offset, so it
 * never changed the winner and is dropped here.) Ties go to the lowest pitch class.
 *
 * @param {import('./types.js').LoopContext} ctx @param {import('../../music/trackKinds.js').TrackKind[]} kinds
 */
export function detectKey(ctx, kinds) {
  const points = new Array(12).fill(0);
  for (const kind of kinds) {
    for (const note of ctx[kind] ?? []) {
      for (let key = 0; key < 12; key++) {
        if (note.pitch === key) points[key] += 2;
        if (MAJOR_SCALES[key].includes(note.pitch)) points[key] += 1;
      }
    }
  }
  let best = 0;
  let max = 0;
  for (let key = 0; key < 12; key++) {
    if (points[key] > max) { max = points[key]; best = key; }
  }
  return best;
}
