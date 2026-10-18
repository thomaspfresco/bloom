# Deployment (Vercel + Flask)

## How Vercel runs this

- `app.py` exports a Flask instance named `app`; Vercel's zero-config Flask support finds it and deploys it as one Vercel Function (Fluid compute).
- `requirements.txt` (`flask`, `mido`) is installed. `.python-version` pins 3.12.
- `public/**` is served by the CDN at the site root (`/css/…`, `/js/…`, `/models/…`). Per Vercel's docs, Flask's own `static_folder` is **not** used for this in production. Locally, `bloom/__init__.py` mounts `public/` at `/` so URLs are identical.
- `vercel.json` sets the function's `maxDuration` and cache headers for heavy static assets.
- `.vercelignore` keeps `tools/` (including the 17 MB `.h5` source models), `tests/` and `docs/` out of the deployment.

## Limits to remember

- Request body ≈ 4.5 MB (the app sends only small JSON to `/api/midi`; `MAX_CONTENT_LENGTH` is 4 MB).
- The function filesystem is read-only except `/tmp`; the app writes nothing.
- No background threads or processes: the old `multiprocessing` drum generation is gone.
- Bundle limit is far above what this app uses (a few MB of Python); the large assets (~14 MB samples + 5 MB models + 1 MB tree-shaken three.js) are CDN static files.

## Cache busting

Pages append `?v=<VERCEL_GIT_COMMIT_SHA[:8]>` to their own CSS/JS entry points. Modules imported from those files keep stable URLs and are cached up to an hour with stale-while-revalidate (`vercel.json`), so a deploy reaches users within ~1 hour at worst for deep modules. If that matters, add a content hash to import specifiers or lower the max-age.

## Deploy

```bash
npm i -g vercel
vercel            # first time: link the project
vercel --prod
```

or connect the GitHub repository (`thomaspfresco/bloom`) in the Vercel dashboard. No build command and no environment variables are required.

## Browser requirements

WebGPU (Chrome/Edge 113+, Safari 26+, Firefox on supported platforms) with automatic WebGL2 fallback; Web Audio; `localStorage`. Web MIDI is optional (Chromium). The mic features need HTTPS (Vercel provides it) or `localhost`.
