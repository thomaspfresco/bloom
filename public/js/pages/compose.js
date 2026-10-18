// @ts-check
// Entry point of the compose page.

import { App } from '../ui/App.js';

const boot = document.getElementById('boot');

/** Phones and tablets are not supported (same as the original). */
function isMobile() {
  const ua = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches && innerWidth < 1100;
  return ua || touchOnly;
}

async function main() {
  if (isMobile()) {
    document.getElementById('desktop-only')?.removeAttribute('hidden');
    boot?.remove();
    return;
  }
  // the original disabled the browser context menu on the whole page (right-click is used by the app)
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('scene'));
  const root = /** @type {HTMLElement} */ (document.getElementById('ui'));
  const forceWebGL = new URLSearchParams(location.search).has('gl');

  try {
    const app = await App.start({ canvas, root, forceWebGL });
    /** @type {any} */ (window).__bloom = app;
    console.info('[bloom] backend:', app.scene.backend);
    boot?.remove();
  } catch (err) {
    console.error(err);
    if (boot) boot.textContent = 'BLOOM could not start in this browser. Try a current Chrome, Edge, Safari or Firefox.';
  }
}

main();
