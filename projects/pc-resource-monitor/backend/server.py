"""FastAPI server for the 515x1920 RigTach Metrix HUD."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from typing import Any

from fastapi import Body, FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.settings import SettingsStore
from backend.telemetry import DemoTelemetryGenerator, SystemTelemetryCollector
from backend.weather import get_weather

BASE_DIR = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))
FRONTEND_DIR = BASE_DIR / "frontend"

app = FastAPI(title="RigTach Metrix (515x1920)", version="1.1.2")

_live_collector = SystemTelemetryCollector()
_demo_collector = DemoTelemetryGenerator()
_settings_store = SettingsStore()
_default_demo = os.environ.get("RESOURCE_MONITOR_DEMO", "0") == "1"
_active_sockets: set[WebSocket] = set()


def _get_payload(demo: bool, sort_by: str) -> dict[str, Any]:
    collector = _demo_collector if demo else _live_collector
    return collector.collect(sort_by=sort_by)


async def _broadcast_settings(settings: dict[str, Any]) -> None:
    dead: list[WebSocket] = []
    for ws in list(_active_sockets):
        try:
            await ws.send_json({"type": "settings", "settings": settings})
        except Exception:
            dead.append(ws)
    for ws in dead:
        _active_sockets.discard(ws)


@app.get("/api/settings")
async def api_get_settings() -> dict[str, Any]:
    return _settings_store.get()


@app.post("/api/settings")
async def api_update_settings(patch: dict[str, Any] = Body(...)) -> dict[str, Any]:
    updated = _settings_store.update(patch)
    await _broadcast_settings(updated)
    return updated


@app.get("/api/telemetry")
async def get_telemetry(
    demo: bool | None = Query(default=None),
    sort: str = Query(default="cpu", pattern="^(cpu|ram)$"),
) -> dict[str, Any]:
    cfg = _settings_store.get()
    use_demo = (_default_demo or bool(cfg.get("demo", False))) if demo is None else demo
    return await asyncio.to_thread(_get_payload, use_demo, sort)


@app.get("/api/weather")
async def api_weather(
    location: str | None = Query(default=None),
    demo: bool | None = Query(default=None),
) -> dict[str, Any]:
    cfg = _settings_store.get()
    loc = location if location is not None else str(cfg.get("location", "Des Moines, IA"))
    use_demo = (_default_demo or bool(cfg.get("demo", False))) if demo is None else demo
    return await asyncio.to_thread(get_weather, loc, use_demo)


@app.websocket("/ws/telemetry")
async def ws_telemetry(
    websocket: WebSocket,
    demo: bool | None = Query(default=None),
    interval: float | None = Query(default=None, ge=0.25, le=5.0),
    sort: str = Query(default="cpu"),
) -> None:
    await websocket.accept()
    _active_sockets.add(websocket)
    sort_by = sort if sort in ("cpu", "ram") else "cpu"
    demo_override = demo

    try:
        # Send current persisted settings immediately on connect
        await websocket.send_json({"type": "settings", "settings": _settings_store.get()})

        while True:
            cfg = _settings_store.get()
            use_demo = (
                demo_override
                if demo_override is not None
                else (_default_demo or bool(cfg.get("demo", False)))
            )
            poll_interval = float(interval if interval is not None else cfg.get("interval", 1.0))

            payload = await asyncio.to_thread(_get_payload, use_demo, sort_by)
            await websocket.send_json(payload)
            try:
                msg = await asyncio.wait_for(websocket.receive_json(), timeout=poll_interval)
                if isinstance(msg, dict):
                    patch: dict[str, Any] = {}
                    if "demo" in msg:
                        demo_override = None
                        patch["demo"] = bool(msg["demo"])
                    if isinstance(msg.get("interval"), (int, float)):
                        interval = None
                        patch["interval"] = float(msg["interval"])
                    if msg.get("sort") in ("cpu", "ram"):
                        sort_by = msg["sort"]
                    if patch:
                        updated = _settings_store.update(patch)
                        await _broadcast_settings(updated)
            except asyncio.TimeoutError:
                pass
    except WebSocketDisconnect:
        return
    finally:
        _active_sockets.discard(websocket)


app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/settings")
async def settings_page() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "settings.html")


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")
