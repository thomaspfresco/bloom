# State model and saved session

All user-authored data is one `Session` (`public/js/model/Session.js`). It is plain data: no audio nodes, DOM or drawing state, so it can be saved, loaded, cloned and tested in Node.

## Classes

| Class | File | Holds |
|---|---|---|
| `Session` | `model/Session.js` | `loops[]`, `structs[]`, open `tabs[]` (max 4), `active` tab. Emits `change` `{scope, id?}`. |
| `Loop` | `model/Loop.js` | `id`, `name`, `tempo` (20-400), `click`, `record`, `tracks[]` (max 4, one per kind) |
| `Track` | `model/Track.js` | `kind` (MELODY/HARMONY/BASS/DRUMS), `muted`, `gain`, `preset`, `presetChanged`, `octaveWindow`, `toggles`, `params[]`, `notes[]` |
| `Note` | `model/Note.js` | `pitch` (0-11, or drum part 0-6), `octave`, `start` (0-63), `duration` (>= 1, ends <= 64) |
| `Parameter` | `model/Parameter.js` | a 0-1 knob `value`, optional per-step `automation[64]`; its `output()` is a table entry (`music/parameterTables.js`) |
| `Structure` | `model/Structure.js` | `tempo`, `transpose`, `useTempo`, `useTranspose`, `sections[]` (max 5) |
| `Section` | `model/Structure.js` | `loopId`, `repeats` (1-8) |

A loop is 64 steps of 16th notes (4 bars of 4/4). `Loop.secondsPerStep = 60 / tempo / 4`.

Parameter and toggle layouts per kind are declared in `model/parameterSpecs.js` (21 parameters for synth tracks and for drums). Option tables (30 time values, 43 pitch-cent values, 101 unit values, 4 waves, 6 delay times) are in `music/parameterTables.js` and match the old app entry for entry.

## Change notification

Mutating methods on `Session` emit `change` themselves. When UI code edits a loop/track/note in place it must call `session.touch('loop', loop.id)`; autosave listens to every `change`.

Scopes: `all`, `loops`, `structs`, `tabs`, `loop`, `struct`.

## Saved JSON (version 1)

Stored under the `localStorage` key `bloom.session`, and written by "Download session" (with an extra `"app": "bloom"` key).

```jsonc
{
  "version": 1,
  "savedAt": "2026-10-16T12:00:00.000Z",
  "loops": [{
    "id": "l_ab12cd34", "name": "myLoop1", "tempo": 120, "click": false, "record": false,
    "tracks": [{
      "id": "t_…", "kind": "BASS", "muted": false, "gain": 1,
      "preset": 3, "presetChanged": false, "octaveWindow": 3,
      "toggles": { "osc1": true, "osc2": true, "env1": true, "env2": true,
                   "filter": true, "dist": false, "delay": false, "reverb": false },
      "params": [{ "id": "osc1.wave", "value": 0, "automating": false, "automation": [0.5, /* x64 */] }],
      "notes":  [{ "id": "n_…", "pitch": 0, "octave": 2, "start": 0, "duration": 8 }]
    }]
  }],
  "structs": [{ "id": "x_…", "name": "myStruct1", "tempo": 120, "transpose": 0,
                "useTempo": false, "useTranspose": false,
                "sections": [{ "id": "s_…", "loopId": "l_ab12cd34", "repeats": 2 }] }],
  "tabs": [{ "type": "loop", "id": "l_ab12cd34" }],
  "active": { "type": "loop", "id": "l_ab12cd34" }
}
```

Drum tracks use toggle ids `part0`..`part6` instead of `osc*`/`env*`, and parameter ids `part0.gain`, `part0.pitch`, ...

## Loading rules ("site check on load")

`SessionStorage.load()` returns one of:

| status | meaning | what happens |
|---|---|---|
| `loaded` | valid | session replaced |
| `empty` | nothing stored | new empty session |
| `corrupt` | unparsable | raw text kept in `bloom.session.corrupt`, key cleared, new session, user is told |
| `newer` | `version` greater than this build | left untouched, **autosave disabled** so it is never overwritten |
| `unavailable` | storage blocked (private mode…) | session works but is not saved |

`Session.fromJSON` is tolerant: unknown or malformed loops, tracks, notes and parameters are dropped, numbers are clamped (`Note.fromJSON` keeps notes inside the loop), and tabs or sections pointing at missing loops are removed. There is no expiry; nothing is deleted automatically.

## Import / export

- Export: `downloadSession(session)` (`persistence/SessionFile.js`) -> `bloom-session-YYYYMMDD-HHMM.json`.
- Import: `readSessionFile(file)` validates size (<= 4 MB), JSON, version, then `Session.fromJSON`. Errors are `SessionFileError` with a user-presentable message.
- Legacy: sessions from the old app (index-keyed objects, `clickState`, `knobs`, ...) are detected by `isLegacySession` and converted by `convertLegacySession` (`persistence/legacy.js`). A real old session is a test fixture (`tests/fixtures/legacy-session.json`).

## Not persisted (UI/runtime state)

Playhead position, selected track, grid view/zoom, hover and drag state, drawer open/closed, search text, generated suggestions, undo history (not implemented in the original either).
