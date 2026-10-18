#!/usr/bin/env python3
"""Sample the ORIGINAL Python generators (needs the old bloomServer checkout).

    python tools/compare_generators.py /path/to/bloomServer OUT.json [n_drums] [n_harmony_bass]

Pair with ``node tools/compare_generators.mjs OUT_JS.json`` and compare the two
JSON files (per-cell drum activation, chord-count / duration histograms). The
2026-10-16 run is summarised in docs/AI_INFERENCE.md.
"""
import json
import os
import sys

server, out = sys.argv[1], os.path.abspath(sys.argv[2])
n_drums = int(sys.argv[3]) if len(sys.argv) > 3 else 200
n_hb = int(sys.argv[4]) if len(sys.argv) > 4 else 400

os.chdir(server)  # the original loads models with relative paths
sys.path.insert(0, server)
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

import numpy as np  # noqa: E402
import musicGeneration as mg  # noqa: E402


class Q:
    def __init__(self):
        self.items = []

    def put(self, x):
        self.items.append(x)


drum = np.zeros((7, 64))
counts = []
for _ in range(n_drums):
    q = Q()
    mg.generateDrums({}, q)
    notes = q.items[0][1]
    counts.append(len(notes))
    for n in notes.values():
        drum[n["pitch"]][n["start"]] += 1

harm, bass = [], []
for _ in range(n_hb):
    notes = mg.generateHarmony({}, False)[1]
    starts = {n["start"] for n in notes.values()}
    harm.append({"chords": len(starts), "first": [n["duration"] for n in notes.values() if n["start"] == 0][0], "size": len(notes)})
    notes = list(mg.generateBass({})[1].values())
    bass.append({"n": len(notes), "first": notes[0]["duration"]})

json.dump({"drum": (drum / n_drums).tolist(), "drum_counts": counts, "harm": harm, "bass": bass}, open(out, "w"))
print("wrote", out)
