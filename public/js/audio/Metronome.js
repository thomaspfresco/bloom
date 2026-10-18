// @ts-check
import { Tone } from './tone.js';
import { CLICK_URLS } from './drumKits.js';

export class Metronome {
  constructor() {
    this.accent = new Tone.Player(CLICK_URLS.accent).toDestination();
    this.beat = new Tone.Player(CLICK_URLS.beat).toDestination();
  }

  /** @param {'accent' | 'beat' | null} kind @param {number} time */
  click(kind, time) {
    if (!kind) return;
    const p = kind === 'accent' ? this.accent : this.beat;
    if (p.loaded) p.start(time);
  }

  dispose() {
    this.accent.dispose();
    this.beat.dispose();
  }
}
