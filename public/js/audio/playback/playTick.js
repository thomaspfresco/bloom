// @ts-check
// Turns one cursor Tick into sound. Shared by live playback and offline export.

/** @typedef {import('./PlaybackCursor.js').Tick} Tick */
/** @typedef {import('../VoiceBank.js').VoiceBank} VoiceBank */

/**
 * @param {Tick} tick @param {VoiceBank} bank @param {number} time audio-context time
 */
export function playTick(tick, bank, time) {
  // A new pass starts clean: nothing from the previous pass may ring on.
  if (tick.wrapped) bank.releaseAll(time);

  // Copy settings (with this step's automation) onto each kind's voice.
  for (const track of tick.tracks) bank.prepare(track, tick.step);

  // Releases before attacks, so back-to-back notes of one pitch retrigger cleanly.
  for (const ev of tick.off) bank.voice(ev.track.kind).noteOff(ev.pitch, ev.octave, time);
  for (const ev of tick.on) bank.voice(ev.track.kind).noteOn(ev.pitch, ev.octave, time);
}
