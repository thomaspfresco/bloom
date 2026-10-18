"""JSON / binary API. Stateless: nothing is stored server-side."""

from __future__ import annotations

from flask import Blueprint, Response, current_app, jsonify, request

from ..services.midi import MidiExportError, render_track_midi

api_bp = Blueprint("api", __name__)


@api_bp.get("/health")
def health():
    return jsonify({"status": "ok"})


@api_bp.post("/midi")
def midi():
    """Render one track to a Standard MIDI File.

    Request JSON::

        {"name": "MELODY", "kind": "MELODY", "tempo": 120,
         "notes": [{"pitch": 0-11, "octave": int, "start": step, "duration": steps}]}
    """
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Expected a JSON object body."}), 400

    cfg = current_app.config
    try:
        data, filename = render_track_midi(
            payload,
            max_steps=cfg["MAX_STEPS"],
            max_notes=cfg["MAX_NOTES_PER_TRACK"],
            tempo_range=cfg["TEMPO_RANGE"],
        )
    except MidiExportError as exc:
        return jsonify({"error": str(exc)}), 400

    return Response(
        data,
        mimetype="audio/midi",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )
