// @ts-check
// Web MIDI keyboard input. Emits note on/off with the old app's octave mapping.

import { Emitter } from '../core/events.js';
import { midiToNote } from '../music/theory.js';

/**
 * @typedef {object} MidiEvents
 * @property {{pitch: number, octave: number, velocity: number}} noteOn
 * @property {{pitch: number, octave: number}} noteOff
 * @property {{connected: boolean, name: string}} device
 */

/** @extends {Emitter<MidiEvents>} */
export class MidiInput extends Emitter {
  constructor() {
    super();
    this.available = false;
    /** @type {any} */
    this.access = null;
  }

  /** Request access; resolves false when unsupported or denied (never throws). */
  async start() {
    if (!('requestMIDIAccess' in navigator)) return false;
    try {
      this.access = await navigator.requestMIDIAccess();
    } catch {
      return false;
    }
    for (const input of this.access.inputs.values()) this.#attach(input);
    this.access.onstatechange = (/** @type {any} */ e) => {
      if (e.port.type !== 'input') return;
      if (e.port.state === 'connected') this.#attach(e.port);
      this.emit('device', { connected: e.port.state === 'connected', name: e.port.name ?? 'MIDI device' });
    };
    this.available = true;
    return true;
  }

  /** @param {any} input */
  #attach(input) {
    input.onmidimessage = (/** @type {any} */ msg) => {
      const [status, note, velocity] = msg.data;
      const command = status & 0xf0;
      const { pitch, octave } = midiToNote(note);
      if (command === 0x90 && velocity > 0) this.emit('noteOn', { pitch, octave, velocity });
      else if (command === 0x80 || (command === 0x90 && velocity === 0)) this.emit('noteOff', { pitch, octave });
    };
  }
}
