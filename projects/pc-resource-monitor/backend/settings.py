"""Persistent settings store for RigTach Metrix."""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any

DEFAULT_SETTINGS: dict[str, Any] = {
    "location": "Des Moines, IA",
    "preset": "cyan",
    "primaryColor": "#22d3ee",
    "secondaryColor": "#10b981",
    "bgColor": "#0d141e",
    "clockFormat": "12",
    "unit": "F",
    "demo": False,
    "interval": 1.0,
}


def _settings_path() -> Path:
    if os.name == "nt":
        base = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
    else:
        base = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    folder = base / "RigTachMetrix"
    folder.mkdir(parents=True, exist_ok=True)
    return folder / "settings.json"


class SettingsStore:
    """Thread-safe JSON settings store with defaults."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._path = _settings_path()
        self._data: dict[str, Any] = dict(DEFAULT_SETTINGS)
        self._load()

    def _load(self) -> None:
        if not self._path.exists():
            return
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                for key in DEFAULT_SETTINGS:
                    if key in raw:
                        self._data[key] = raw[key]
        except Exception:
            pass

    def _save(self) -> None:
        try:
            self._path.write_text(json.dumps(self._data, indent=2), encoding="utf-8")
        except Exception:
            pass

    def get(self) -> dict[str, Any]:
        with self._lock:
            return dict(self._data)

    def update(self, patch: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            for key, val in patch.items():
                if key not in DEFAULT_SETTINGS:
                    continue
                if key == "interval":
                    try:
                        self._data[key] = max(0.25, min(5.0, float(val)))
                    except (TypeError, ValueError):
                        pass
                elif key == "demo":
                    self._data[key] = bool(val)
                elif key in ("clockFormat", "unit", "preset", "primaryColor", "secondaryColor", "bgColor", "location"):
                    self._data[key] = str(val)
            self._save()
            return dict(self._data)
