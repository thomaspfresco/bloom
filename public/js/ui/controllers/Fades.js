// @ts-check
// "Blackout" transitions of the original: after some changes a black rectangle
// covering part of the screen starts opaque and fades away at 10/255 per frame
// (about 425 ms), so the new content appears to fade in from black.

import { Emitter } from '../../core/events.js';

/**
 * Regions that can fade in from black.
 *  - screen: the whole page below the tab bar (new tab, back to home)
 *  - controls: left and right ends of the bottom strip (tempo / click / record, view icons)
 *  - context: the strip holding the octave / preset / parameter scroller
 *  - grid: the main editing area
 *  - ruler: the time bar
 * @typedef {'screen' | 'controls' | 'context' | 'grid' | 'ruler'} FadeRegion
 */

/** @extends {Emitter<{fade: FadeRegion[]}>} */
export class Fades extends Emitter {
  /** @param {...FadeRegion} regions */
  play(...regions) {
    this.emit('fade', regions);
  }

  /** A track was opened in the editor (`fromNone`: no track was open before). @param {boolean} fromNone */
  trackSelected(fromNone) {
    /** @type {FadeRegion[]} */
    const regions = fromNone ? ['controls', 'ruler', 'context', 'grid'] : ['context', 'grid'];
    this.play(...regions);
  }

  /** The editor switched between grid / studio / automation. */
  viewChanged() {
    this.play('context', 'grid');
  }
}
