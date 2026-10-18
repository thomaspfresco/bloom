#!/usr/bin/env python3
"""Export the legacy Keras ``.h5`` models to a browser-friendly format.

For every ``tools/source_models/<name>.h5`` this writes::

    public/models/<name>.json   architecture + tensor table
    public/models/<name>.bin    all weights, little-endian float32, concatenated

and a ``public/models/manifest.json`` listing the models.

Requires TensorFlow/Keras (dev-time only; it is NOT a runtime dependency)::

    python -m venv .venv && . .venv/bin/activate
    pip install tensorflow numpy
    python tools/export_models.py

The JS runtime in ``public/js/ai/lstm.js`` implements exactly the layers listed
in ``SUPPORTED_LAYERS`` below; anything else makes this script fail loudly.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "source_models"
OUT = ROOT / "public" / "models"

SUPPORTED_LAYERS = {"InputLayer", "Embedding", "LSTM", "Dense", "TimeDistributed"}


class Packer:
    """Appends float32 tensors to one buffer and records their offsets."""

    def __init__(self) -> None:
        self.chunks: list[bytes] = []
        self.offset = 0  # in float32 elements

    def add(self, array: np.ndarray) -> dict:
        flat = np.ascontiguousarray(array, dtype="<f4").ravel()
        entry = {"shape": list(array.shape), "offset": self.offset, "length": int(flat.size)}
        self.chunks.append(flat.tobytes())
        self.offset += int(flat.size)
        return entry

    def tobytes(self) -> bytes:
        return b"".join(self.chunks)


def describe_dense(layer, packer: Packer, time_distributed: bool) -> dict:
    kernel, bias = layer.get_weights()
    return {
        "type": "dense",
        "units": int(layer.units),
        "activation": layer.activation.__name__,
        "timeDistributed": time_distributed,
        "kernel": packer.add(kernel),
        "bias": packer.add(bias),
    }


def describe_layer(layer, packer: Packer) -> dict | None:
    kind = layer.__class__.__name__
    if kind not in SUPPORTED_LAYERS:
        raise SystemExit(f"Unsupported layer type: {kind}")
    if kind == "InputLayer":
        return None
    if kind == "Embedding":
        (embeddings,) = layer.get_weights()
        return {
            "type": "embedding",
            "inputDim": int(layer.input_dim),
            "outputDim": int(layer.output_dim),
            "embeddings": packer.add(embeddings),
        }
    if kind == "LSTM":
        kernel, recurrent, bias = layer.get_weights()
        if layer.activation.__name__ != "tanh" or layer.recurrent_activation.__name__ != "sigmoid":
            raise SystemExit("Only tanh/sigmoid LSTMs are supported.")
        return {
            "type": "lstm",
            "units": int(layer.units),
            "returnSequences": bool(layer.return_sequences),
            "kernel": packer.add(kernel),
            "recurrentKernel": packer.add(recurrent),
            "bias": packer.add(bias),
        }
    if kind == "Dense":
        return describe_dense(layer, packer, False)
    # TimeDistributed wrapping a Dense
    inner = layer.layer
    if inner.__class__.__name__ != "Dense":
        raise SystemExit("TimeDistributed is only supported around Dense.")
    return describe_dense(inner, packer, True)


def export_model(path: Path) -> dict:
    from tensorflow.keras.models import load_model  # imported late: slow

    model = load_model(path, compile=False)
    packer = Packer()
    layers = [d for d in (describe_layer(l, packer) for l in model.layers) if d]

    shape = [None if d is None else int(d) for d in model.input_shape]
    spec = {
        "name": path.stem,
        "inputShape": shape,  # [batch, timesteps(, features)]
        "layers": layers,
        "weights": f"{path.stem}.bin",
    }
    (OUT / f"{path.stem}.json").write_text(json.dumps(spec, indent=1))
    (OUT / f"{path.stem}.bin").write_bytes(packer.tobytes())
    return {"name": path.stem, "bytes": packer.offset * 4}


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    files = sorted(SRC.glob("*.h5"))
    if not files:
        print(f"No .h5 files in {SRC}", file=sys.stderr)
        return 1
    manifest = [export_model(f) for f in files]
    (OUT / "manifest.json").write_text(json.dumps({"models": manifest}, indent=1))
    for m in manifest:
        print(f"{m['name']:>16}  {m['bytes'] / 1024:8.1f} KiB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
