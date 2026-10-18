"""Static configuration. Nothing here reads secrets: BLOOM has no accounts."""

from __future__ import annotations

import os
from pathlib import Path


class Config:
    ROOT_DIR = Path(__file__).resolve().parent.parent
    PUBLIC_DIR = ROOT_DIR / "public"
    TEMPLATE_DIR = ROOT_DIR / "templates"

    # Appended to asset URLs (?v=...) so a deploy busts CDN/browser caches.
    ASSET_VERSION = (os.environ.get("VERCEL_GIT_COMMIT_SHA") or "dev")[:8]

    # Vercel request bodies are capped at ~4.5 MB; a session export is far smaller.
    MAX_CONTENT_LENGTH = 4 * 1024 * 1024

    # MIDI export limits (mirror the client limits in public/js/core/constants.js).
    MAX_STEPS = 64
    MAX_NOTES_PER_TRACK = 2048
    TEMPO_RANGE = (20, 400)
