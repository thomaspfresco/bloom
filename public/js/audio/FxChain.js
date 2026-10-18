// @ts-check
import { Tone } from './tone.js';

/**
 * filter -> distortion -> ping-pong delay -> reverb -> gain -> limiter -> stereo
 * split with a level meter per side. Port of the old FxChain class.
 */
export class FxChain {
  constructor() {
    this.distortion = new Tone.Distortion({ wet: 0.5 });
    this.delay = new Tone.PingPongDelay();
    this.reverb = new Tone.Reverb({ preDelay: 0 });
    this.limiter = new Tone.Limiter(-1);
    this.gain = new Tone.Gain();
    this.splitter = new Tone.Split();
    this.left = new Tone.Meter();
    this.right = new Tone.Meter();
    this.panLeft = new Tone.Panner(-1).toDestination();
    this.panRight = new Tone.Panner(1).toDestination();

    /** Voices connect their output here. */
    this.filter = new Tone.Filter().chain(this.distortion, this.delay, this.reverb, this.gain, this.limiter, this.splitter);

    this.splitter.connect(this.left, 0, 0);
    this.splitter.connect(this.right, 1, 0);
    this.left.connect(this.panLeft);
    this.right.connect(this.panRight);
  }

  /** Current level of each side in dB (-Infinity when silent). */
  levels() {
    return [this.left.getValue(), this.right.getValue()];
  }

  dispose() {
    for (const n of [this.filter, this.distortion, this.delay, this.reverb, this.limiter, this.gain, this.splitter, this.left, this.right, this.panLeft, this.panRight]) n.dispose();
  }
}
