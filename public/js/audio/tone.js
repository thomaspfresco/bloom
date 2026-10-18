// @ts-check
// Tone.js is loaded as a classic <script> (public/vendor/tone/Tone.js, v14.7.77)
// before any module runs, because its UMD bundle has no single-file ESM build.
// Every audio module imports it from here so there is exactly one access point
// (and one place to fail clearly if the script is missing).

/** @type {any} */
const Tone = /** @type {any} */ (globalThis).Tone;

if (!Tone) {
  throw new Error('Tone.js is not loaded. Include /vendor/tone/Tone.js before the BLOOM scripts.');
}

export { Tone };
