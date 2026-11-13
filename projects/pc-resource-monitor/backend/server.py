"""FastAPI server for the 515x1920 PC Resource Monitor."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.telemetry import DemoTelemetryGenerator, SystemTelemetryCollector

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

app = FastAPI(title="PC Resource Monitor (515x1920)", version="1.0.0")

_live_collector = SystemTelemetryCollector()
_demo_collector = DemoTelemetryGenerator()
_default_demo = os.environ.get("RESOURCE_MONITOR_DEMO", "0") == "1"


def _get_payload(demo: bool, sort_by: str) -> dict[str, Any]:
    collector = _demo_collector if demo else _live_collector
    return collector.collect(sort_by=sort_by)


@app.get("/api/telemetry")
async def get_telemetry(
    demo: bool | None = Query(default=None),
    sort: str = Query(default="cpu", pattern="^(cpu|ram)$"),
) -> dict[str, Any]:
    use_demo = _default_demo if demo is None else demo
    return await asyncio.to_thread(_get_payload, use_demo, sort)


@app.websocket("/ws/telemetry")
async def ws_telemetry(
    websocket: WebSocket,
    demo: bool | None = Query(default=None),
    interval: float = Query(default=1.0, ge=0.25, le=5.0),
    sort: str = Query(default="cpu"),
) -> None:
    await websocket.accept()
    use_demo = _default_demo if demo is None else demo
    sort_by = sort if sort in ("cpu", "ram") else "cpu"

    try:
        while True:
            payload = await asyncio.to_thread(_get_payload, use_demo, sort_by)
            await websocket.send_json(payload)
            try:
                # Non-blocking check for client config updates (e.g. sort/demo/interval)
                msg = await asyncio.wait_for(websocket.receive_json(), timeout=interval)
                if isinstance(msg, dict):
                    if "demo" in msg:
                        use_demo = bool(msg["demo"])
                    if msg.get("sort") in ("cpu", "ram"):
                        sort_by = msg["sort"]
                    if isinstance(msg.get("interval"), (int, float)):
                        interval = max(0.25, min(5.0, float(msg["interval"])))
            except asyncio.TimeoutError:
                pass
    except WebSocketDisconnect:
        return


app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")
