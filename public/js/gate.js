// @ts-check
// Loads the heavy part of a page (Tone.js, three.js, the app) only on wide
// screens. Below the breakpoint just the HTML and CSS (the splash) are used;
// if the window grows later, the app is loaded then. The breakpoint is the one
// in css/base.css (#splash).
//
// Used by a script tag: <script type="module" src="/js/gate.js"
//   data-classic="/vendor/tone/Tone.js" data-entry="/js/pages/compose.js">

const MIN_WIDTH = 1200;

const tag = /** @type {HTMLScriptElement | null} */ (document.currentScript ?? document.querySelector('script[data-entry]'));
const classic = tag?.dataset.classic;
const entry = tag?.dataset.entry;

/** @param {string} src */
function loadClassic(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve(undefined);
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.append(s);
  });
}

async function start() {
  if (classic) await loadClassic(classic);
  if (entry) await import(entry);
}

const query = matchMedia(`(min-width: ${MIN_WIDTH}px)`);
let started = false;
const check = () => {
  if (started || !query.matches) return;
  started = true;
  query.removeEventListener('change', check);
  start().catch((err) => console.error(err));
};
query.addEventListener('change', check);
check();
