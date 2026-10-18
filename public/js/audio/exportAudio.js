// @ts-check
// Offline (faster than real time) rendering of a loop or structure to WAV.
// Uses the same PlaybackCursor + playTick as live playback.

import { PlaybackCursor } from './playback/PlaybackCursor.js';
import { playTick } from './playback/playTick.js';
import { DRUM_PRESETS } from '../music/presets.js';
import { Tone } from './tone.js';
import { VoiceBank } from './VoiceBank.js';
import { loadKit } from './drumKits.js';
import { audioBufferToWav } from './wav.js';

/** @typedef {import('./playback/PlaybackCursor.js').PlaybackPlan} PlaybackPlan */

/** Seconds of reverb/release tail appended after the last step. */
const LOOP_TAIL_FRACTION = 0.25; // of a loop's length
const STRUCT_TAIL_SECONDS = 5;

/** @param {PlaybackPlan} plan */
function planLoops(plan) {
  if (plan.type === 'loop') return [plan.loop];
  return plan.struct.sections.map((s) => plan.resolveLoop(s.loopId)).filter((l) => l !== null);
}

/** Length in seconds of one pass of the plan, including the tail. @param {PlaybackPlan} plan */
export function planDuration(plan) {
  if (plan.type === 'loop') {
    const len = plan.loop.secondsPerStep * plan.loop.nSteps;
    return len * (1 + LOOP_TAIL_FRACTION);
  }
  let seconds = 0;
  for (const section of plan.struct.sections) {
    const loop = plan.resolveLoop(section.loopId);
    if (!loop) continue;
    const bpm = plan.struct.useTempo ? plan.struct.tempo : loop.tempo;
    seconds += (60 / bpm / 4) * loop.nSteps * section.repeats;
  }
  return seconds + STRUCT_TAIL_SECONDS;
}

/**
 * Render a plan to an AudioBuffer.
 * @param {PlaybackPlan} plan @returns {Promise<AudioBuffer>}
 */
export async function renderPlan(plan) {
  // Drum samples must be in memory before the (synchronous) offline graph is built.
  const drumTracks = planLoops(plan).flatMap((l) => l.tracks.filter((t) => t.isDrums));
  const kits = new Set(drumTracks.map((t) => DRUM_PRESETS[t.preset].kit));
  await Promise.all([...kits].map((k) => loadKit(k)));

  const duration = planDuration(plan);
  // The first track of each kind configures that kind's voice (see VoiceBank.warmUp).
  const tracks = planLoops(plan).flatMap((l) => l.tracks);

  const buffer = await Tone.Offline(async (/** @type {{transport: any}} */ { transport }) => {
    const bank = new VoiceBank({ lockReverbDecay: true });
    await bank.warmUp(tracks);
    const cursor = new PlaybackCursor({ ...plan, finite: true });
    transport.scheduleRepeat((/** @type {number} */ time) => {
      const tick = cursor.advance();
      if (!tick) return;
      transport.bpm.value = tick.bpm;
      playTick(tick, bank, time);
      if (tick.done) bank.releaseAll(time + 60 / tick.bpm / 4);
    }, '16n');
    transport.start();
  }, duration);
  return buffer.get();
}

/** @param {PlaybackPlan} plan @returns {Promise<Blob>} */
export async function renderPlanToWav(plan) {
  const audio = await renderPlan(plan);
  return new Blob([audioBufferToWav(audio)], { type: 'audio/wav' });
}

/** Save a blob through a temporary link. @param {Blob} blob @param {string} filename */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
