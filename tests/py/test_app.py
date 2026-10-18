import io
import sys
from pathlib import Path

import mido
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from bloom import create_app  # noqa: E402


@pytest.fixture()
def client():
    app = create_app()
    app.testing = True
    return app.test_client()


@pytest.mark.parametrize("path", ["/", "/about", "/help", "/upload"])
def test_pages_render(client, path):
    res = client.get(path)
    assert res.status_code == 200
    assert b"<canvas id=\"scene\"" in res.data


def test_compose_loads_tone_and_module_entry(client):
    html = client.get("/").data.decode()
    # the heavy parts load through the width gate (js/gate.js)
    assert 'src="/js/gate.js' in html
    assert 'data-classic="/vendor/tone/Tone.js' in html
    assert 'data-entry="/js/pages/compose.js' in html
    assert '"three": "/vendor/three/three.bundle.js"' in html


def test_unknown_page_is_404(client):
    res = client.get("/nope")
    assert res.status_code == 404
    assert b"Nothing here" in res.data


def test_static_assets_are_served_from_root(client):
    assert client.get("/css/tokens.css").status_code == 200
    assert client.get("/models/manifest.json").status_code == 200
    assert client.get("/meshes/petal.obj").status_code == 200
    assert client.get("/samples/kick_acoustic.wav").status_code == 200


def test_health(client):
    assert client.get("/api/health").get_json() == {"status": "ok"}


def midi_notes(data: bytes):
    mid = mido.MidiFile(file=io.BytesIO(data))
    t = 0
    out = []
    on = {}
    for msg in mid.tracks[0]:
        t += msg.time
        if msg.type == "note_on" and msg.velocity > 0:
            on[msg.note] = t
        elif msg.type in ("note_off", "note_on"):
            out.append((msg.note, on.pop(msg.note), t))
    tempo = next(m.tempo for m in mid.tracks[0] if m.type == "set_tempo")
    return sorted(out, key=lambda n: n[1]), mid.ticks_per_beat, tempo


def test_midi_export_pitched(client):
    res = client.post("/api/midi", json={
        "name": "BASS", "kind": "BASS", "tempo": 120,
        "notes": [
            {"pitch": 0, "octave": 2, "start": 0, "duration": 4},
            {"pitch": 7, "octave": 2, "start": 8, "duration": 8},
        ],
    })
    assert res.status_code == 200
    assert res.mimetype == "audio/midi"
    assert 'filename="BASS.mid"' in res.headers["Content-Disposition"]
    notes, tpb, tempo = midi_notes(res.data)
    # pitch + 12*octave, one step = a 16th = tpb/4 ticks
    assert notes == [(24, 0, 4 * tpb // 4), (31, 8 * tpb // 4, 16 * tpb // 4)]
    assert mido.tempo2bpm(tempo) == pytest.approx(120)


def test_midi_export_drum_mapping(client):
    # kick=36, snare(1)->38, closed hat(2)->42, open hat(3)->46, crash(6)->49
    notes_in = [{"pitch": p, "octave": 0, "start": i, "duration": 1} for i, p in enumerate([0, 1, 2, 3, 6])]
    res = client.post("/api/midi", json={"name": "DRUMS", "kind": "DRUMS", "tempo": 100, "notes": notes_in})
    notes, _, _ = midi_notes(res.data)
    assert [n[0] for n in notes] == [36, 38, 42, 46, 49]


@pytest.mark.parametrize("body", [
    None,
    [],
    {"notes": "x"},
    {"notes": [], "tempo": 5},
    {"notes": [{"pitch": 0, "octave": 2, "start": 63, "duration": 5}]},
    {"notes": [{"pitch": "a", "octave": 2, "start": 0, "duration": 1}]},
    {"kind": "DRUMS", "notes": [{"pitch": 9, "octave": 0, "start": 0, "duration": 1}]},
    {"notes": [{"pitch": 0, "octave": 99, "start": 0, "duration": 1}]},
    {"notes": [{"pitch": 0, "octave": 2, "start": 0, "duration": 0}]},
])
def test_midi_rejects_bad_requests(client, body):
    res = client.post("/api/midi", json=body) if body is not None else client.post("/api/midi", data="x")
    assert res.status_code == 400
    assert "error" in res.get_json()


def test_midi_filename_is_sanitised(client):
    res = client.post("/api/midi", json={"name": "../../etc/passwd\r\nX: y", "notes": []})
    assert res.status_code == 200
    disposition = res.headers["Content-Disposition"]
    assert "/" not in disposition.split("filename=")[1]
    assert "\n" not in disposition and "\r" not in disposition
