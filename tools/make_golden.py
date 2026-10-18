#!/usr/bin/env python3
"""Generate tests/fixtures/lstm.golden.json: Keras outputs for fixed inputs.

The JS test (tests/js/lstm.test.js) checks that public/js/ai/lstm.js reproduces
them. Run after re-exporting models. Requires TensorFlow (dev-time only).
"""
import json
from pathlib import Path

import numpy as np
from tensorflow.keras.models import load_model

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "source_models"
OUT = ROOT / "tests" / "fixtures" / "lstm.golden.json"

rng = np.random.default_rng(1234)
cases = []

def add_tokens(name, tokens):
    model = load_model(SRC / f"{name}.h5", compile=False)
    x = np.array([tokens], dtype="int32")
    y = model.predict(x, verbose=0)[0]
    cases.append({"model": name, "input": tokens, "output": y.tolist()})

def add_features(name, steps, features=6):
    model = load_model(SRC / f"{name}.h5", compile=False)
    x = (rng.random((1, steps, features)) > 0.7).astype("float32")
    y = model.predict(x, verbose=0)[0]
    cases.append({"model": name, "input": x[0].tolist(), "output": y.tolist()})

add_tokens("harmonyAndBass", [3, 5, 1, 2])
add_tokens("harmonyAndBass", [1, 4, 6, 7])
add_tokens("durations2", [32, 16, 40, 8])
add_tokens("durations5", [16, 8, 4, 12])
add_features("drums1", 31)
add_features("drums4", 20)
add_features("brakes", 15)

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(cases))
print(f"wrote {OUT} ({len(cases)} cases)")
