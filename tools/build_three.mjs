// Builds public/vendor/three/three.bundle.js: only the parts of three.js the app imports, tree-shaken and minified.
// Re-run after adding a three import:  npm run build:three
// The app itself still has no build step; the import map (templates/base.html) points every three specifier at this file.
import { build } from 'esbuild';
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const names = { 'three/webgpu': new Set(), 'three/tsl': new Set(), 'three/addons/OBJLoader.js': new Set() };

/** @param {string} dir */
function scan(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { scan(p); continue; }
    if (!p.endsWith('.js')) continue;
    for (const m of readFileSync(p, 'utf8').matchAll(/import\s*\{([^}]*)\}\s*from\s*'(three[^']*)'/g)) {
      if (!names[m[2]]) throw new Error(`Unhandled three import '${m[2]}' in ${p}`);
      for (const n of m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)) names[m[2]].add(n);
    }
  }
}
scan(join(root, 'public/js'));

// one export list: webgpu + tsl names (they never collide) + OBJLoader
const entry = Object.entries(names)
  .filter(([, set]) => set.size)
  .map(([mod, set]) => `export { ${[...set].sort().join(', ')} } from '${mod}';`)
  .join('\n');

const tmp = join(root, 'tools/.three-entry.js');
writeFileSync(tmp, entry);
mkdirSync(join(root, 'public/vendor/three'), { recursive: true });
try {
  await build({
    entryPoints: [tmp], outfile: join(root, 'public/vendor/three/three.bundle.js'),
    bundle: true, format: 'esm', minify: true, treeShaking: true, legalComments: 'none',
    banner: { js: '/* three.js r186 (MIT, https://threejs.org), tree-shaken for BLOOM by tools/build_three.mjs */' },
    alias: { 'three/addons/OBJLoader.js': join(root, 'node_modules/three/examples/jsm/loaders/OBJLoader.js') },
    nodePaths: [join(root, 'node_modules')], logLevel: 'info',
  });
} finally { rmSync(tmp, { force: true }); }
