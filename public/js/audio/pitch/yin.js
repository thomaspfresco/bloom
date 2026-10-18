// @ts-check
// YIN fundamental-frequency estimator (de Cheveigné & Kawahara, 2002).
// Pure JS, no dependencies: monophonic singing and humming.

/**
 * @typedef {object} YinOptions
 * @property {number} [fmin] lowest pitch to look for (Hz)
 * @property {number} [fmax] highest pitch to look for (Hz)
 * @property {number} [threshold] absolute threshold on the normalised difference (lower = stricter)
 */

/**
 * Estimate the pitch of one frame.
 * @param {Float32Array} frame samples (at least 2 * sampleRate / fmin long for a stable result)
 * @param {number} sampleRate
 * @param {YinOptions} [opts]
 * @returns {{freq: number, confidence: number} | null} null when the frame is not clearly pitched
 */
export function yin(frame, sampleRate, { fmin = 70, fmax = 1000, threshold = 0.15 } = {}) {
  const half = Math.floor(frame.length / 2);
  const tauMax = Math.min(half - 1, Math.floor(sampleRate / fmin));
  const tauMin = Math.max(2, Math.floor(sampleRate / fmax));
  if (tauMax <= tauMin + 2) return null;

  // difference function
  const d = new Float32Array(tauMax + 2);
  for (let tau = 1; tau <= tauMax + 1 && tau < half; tau++) {
    let sum = 0;
    for (let j = 0; j < half; j++) {
      const diff = frame[j] - frame[j + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }

  // cumulative mean normalised difference
  const cmnd = new Float32Array(tauMax + 2);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau < cmnd.length; tau++) {
    running += d[tau];
    cmnd[tau] = running === 0 ? 1 : (d[tau] * tau) / running;
  }

  // first dip below the threshold, then follow it to its local minimum
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 <= tauMax && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau === -1) {
    // no clear dip: take the global minimum if it is at least somewhat periodic
    let best = tauMin;
    for (let t = tauMin; t <= tauMax; t++) if (cmnd[t] < cmnd[best]) best = t;
    if (cmnd[best] > 0.35) return null;
    tau = best;
  }

  // parabolic interpolation for sub-sample accuracy
  const a = cmnd[tau - 1], b = cmnd[tau], c = cmnd[tau + 1];
  const denom = a - 2 * b + c;
  const shift = denom === 0 ? 0 : (a - c) / (2 * denom);
  const better = tau + Math.max(-1, Math.min(1, shift));
  return { freq: sampleRate / better, confidence: Math.max(0, Math.min(1, 1 - cmnd[tau])) };
}

/** @param {number} freq Hz @returns {number} fractional MIDI note number (A4 = 69) */
export const freqToMidi = (freq) => 69 + 12 * Math.log2(freq / 440);
