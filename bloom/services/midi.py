"""Track -> Standard MIDI File.

Port of ``/renderMidi`` from the old bloomServer (``pretty_midi``), rewritten on
``mido`` so the serverless bundle stays tiny. One step is a 16th note.
"""

from __future__ import annotations

import io
import re
from typing import Any

import mido

TICKS_PER_BEAT = 480
TICKS_PER_STEP = TICKS_PER_BEAT // 4  # 16th note
VELOCITY = 127

# BLOOM drum part index -> offset from MIDI note 36, matching the old server
# ("adjust to DAW's standard drum kit"): kick, snare, closed hat, open hat,
# high tom, low tom, crash.
DRUM_OFFSETS = {0: 0, 1: 2, 2: 6, 3: 10, 4: 9, 5: 7, 6: 13}
DRUM_BASE = 12 * 3


class MidiExportError(ValueError):
    """Raised for malformed export requests; message is safe to show users."""


def _safe_filename(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_\- ]+", "", name).strip() or "bloom"
    return f"{cleaned[:40]}.mid"


def _as_int(value: Any, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise MidiExportError(f"Note field '{field}' must be a number.")
    return int(value)


def _midi_pitch(note: dict, is_drums: bool) -> int:
    pitch = _as_int(note.get("pitch"), "pitch")
    if is_drums:
        if pitch not in DRUM_OFFSETS:
            raise MidiExportError(f"Unknown drum part {pitch}.")
        return DRUM_BASE + DRUM_OFFSETS[pitch]
    octave = _as_int(note.get("octave"), "octave")
    return pitch + 12 * octave


def render_track_midi(
    payload: dict,
    *,
    max_steps: int,
    max_notes: int,
    tempo_range: tuple[int, int],
) -> tuple[bytes, str]:
    """Validate ``payload`` and return ``(midi_bytes, filename)``."""
    notes = payload.get("notes")
    if not isinstance(notes, list):
        raise MidiExportError("'notes' must be a list.")
    if len(notes) > max_notes:
        raise MidiExportError("Too many notes.")

    tempo = _as_int(payload.get("tempo", 120), "tempo")
    if not tempo_range[0] <= tempo <= tempo_range[1]:
        raise MidiExportError("Tempo out of range.")

    is_drums = payload.get("kind") == "DRUMS"
    name = payload.get("name") if isinstance(payload.get("name"), str) else "bloom"

    events: list[tuple[int, int, int]] = []  # (tick, order, midi_note); order 0=off 1=on
    for note in notes:
        if not isinstance(note, dict):
            raise MidiExportError("Each note must be an object.")
        start = _as_int(note.get("start"), "start")
        duration = _as_int(note.get("duration"), "duration")
        if start < 0 or duration < 1 or start + duration > max_steps:
            raise MidiExportError("Note outside the loop.")
        midi_note = _midi_pitch(note, is_drums)
        if not 0 <= midi_note <= 127:
            raise MidiExportError("Pitch out of MIDI range.")
        events.append((start * TICKS_PER_STEP, 1, midi_note))
        events.append(((start + duration) * TICKS_PER_STEP, 0, midi_note))

    events.sort()

    mid = mido.MidiFile(type=0, ticks_per_beat=TICKS_PER_BEAT)
    track = mido.MidiTrack()
    mid.tracks.append(track)
    track.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(tempo), time=0))
    track.append(mido.MetaMessage("track_name", name=name[:40], time=0))

    last_tick = 0
    for tick, order, midi_note in events:
        msg_type = "note_on" if order else "note_off"
        track.append(
            mido.Message(
                msg_type,
                note=midi_note,
                velocity=VELOCITY if order else 0,
                time=tick - last_tick,
            )
        )
        last_tick = tick
    track.append(mido.MetaMessage("end_of_track", time=0))

    buffer = io.BytesIO()
    mid.save(file=buffer)
    return buffer.getvalue(), _safe_filename(name)
