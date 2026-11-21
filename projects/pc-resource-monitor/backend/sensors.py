"""Background hardware sensor reader (LibreHardwareMonitor HTTP/WMI + Linux psutil)."""

from __future__ import annotations

import json
import os
import re
import subprocess
import threading
import time
import urllib.request
from typing import Any

import psutil


def _parse_number(text: str) -> float | None:
    if not text:
        return None
    m = re.search(r"-?\d+(?:\.\d+)?", text.replace(",", ""))
    if not m:
        return None
    try:
        return float(m.group(0))
    except ValueError:
        return None


def _short_fan_name(raw: str) -> str:
    name = raw.strip()
    replacements = (
        ("Fan #", "FAN "),
        ("System Fan", "SYS"),
        ("Chassis Fan", "CASE"),
        ("CPU Optional", "CPU OPT"),
        ("CPU Fan", "CPU"),
        ("Pump Fan", "PUMP"),
        ("AIO Pump", "AIO"),
        ("Water Pump", "PUMP"),
    )
    for old, new in replacements:
        if old.lower() in name.lower():
            name = re.sub(re.escape(old), new, name, flags=re.IGNORECASE)
            break
    return name[:14]


def _fan_sort_key(item: dict[str, Any]) -> tuple[int, str]:
    n = item["name"].lower()
    if "cpu" in n:
        return (0, n)
    if "pump" in n or "aio" in n:
        return (1, n)
    if "gpu" in n:
        return (2, n)
    return (3, n)


class HardwareSensorReader:
    """Polls LibreHardwareMonitor (HTTP JSON or WMI) in a background daemon thread."""

    def __init__(self, http_url: str = "http://127.0.0.1:8085/data.json") -> None:
        self._http_url = http_url
        self._lock = threading.Lock()
        self._data: dict[str, Any] = {
            "available": False,
            "source": None,
            "cpu_temp_c": None,
            "fans": [],
        }
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "available": self._data["available"],
                "source": self._data["source"],
                "cpu_temp_c": self._data["cpu_temp_c"],
                "fans": list(self._data["fans"]),
            }

    def _walk_lhm_json(
        self, node: dict[str, Any], fans: list[dict[str, Any]], temps: list[tuple[str, float]]
    ) -> None:
        text = str(node.get("Text", ""))
        val_str = str(node.get("Value", ""))
        sensor_type = str(node.get("Type", ""))

        if sensor_type == "Fan" or val_str.endswith("RPM"):
            rpm = _parse_number(val_str)
            if rpm is not None and rpm > 0:
                fans.append({"name": _short_fan_name(text), "rpm": int(round(rpm))})
        elif sensor_type == "Temperature" or "°C" in val_str:
            temp = _parse_number(val_str)
            if temp is not None and 5.0 <= temp <= 125.0:
                temps.append((text.lower(), temp))

        for child in node.get("Children") or []:
            if isinstance(child, dict):
                self._walk_lhm_json(child, fans, temps)

    @staticmethod
    def _pick_cpu_temp(temps: list[tuple[str, float]]) -> float | None:
        for priority in ("cpu package", "package", "tctl", "tdie", "core max", "core average"):
            for name, val in temps:
                if priority in name:
                    return round(val, 1)
        return None

    def _poll_lhm_http(self) -> dict[str, Any] | None:
        try:
            req = urllib.request.Request(self._http_url, headers={"User-Agent": "RigTachMetrix"})
            with urllib.request.urlopen(req, timeout=0.6) as resp:
                tree = json.loads(resp.read().decode("utf-8"))
        except Exception:
            return None

        fans: list[dict[str, Any]] = []
        temps: list[tuple[str, float]] = []
        self._walk_lhm_json(tree, fans, temps)
        fans.sort(key=_fan_sort_key)
        return {
            "available": True,
            "source": "lhm-http",
            "cpu_temp_c": self._pick_cpu_temp(temps),
            "fans": fans[:6],
        }

    def _poll_lhm_wmi(self) -> dict[str, Any] | None:
        if os.name != "nt":
            return None

        ps_script = (
            "$ns = $null; "
            "foreach ($n in @('root/LibreHardwareMonitor','root/OpenHardwareMonitor')) { "
            "  try { $s = Get-CimInstance -Namespace $n -ClassName Sensor -ErrorAction Stop "
            "    | Where-Object { $_.SensorType -eq 'Fan' -or $_.SensorType -eq 'Temperature' } "
            "    | Select-Object Name,SensorType,Value; "
            "    if ($s) { $ns = $n; $s | ConvertTo-Json -Compress; break } "
            "  } catch {} "
            "}"
        )
        try:
            res = subprocess.run(
                ["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", ps_script],
                capture_output=True,
                text=True,
                timeout=3.0,
                creationflags=subprocess.CREATE_NO_WINDOW,  # type: ignore[attr-defined]
            )
            if res.returncode != 0 or not res.stdout.strip():
                return None
            raw = json.loads(res.stdout.strip())
            rows = raw if isinstance(raw, list) else [raw]
        except Exception:
            return None

        fans: list[dict[str, Any]] = []
        temps: list[tuple[str, float]] = []
        for row in rows:
            stype = str(row.get("SensorType", ""))
            name = str(row.get("Name", ""))
            val = row.get("Value")
            if val is None:
                continue
            try:
                fval = float(val)
            except (TypeError, ValueError):
                continue
            if stype == "Fan" and fval > 0:
                fans.append({"name": _short_fan_name(name), "rpm": int(round(fval))})
            elif stype == "Temperature" and 5.0 <= fval <= 125.0:
                temps.append((name.lower(), fval))

        fans.sort(key=_fan_sort_key)
        return {
            "available": True,
            "source": "lhm-wmi",
            "cpu_temp_c": self._pick_cpu_temp(temps),
            "fans": fans[:6],
        }

    def _poll_psutil_fans(self) -> dict[str, Any] | None:
        if not hasattr(psutil, "sensors_fans"):
            return None
        try:
            raw = psutil.sensors_fans()
        except Exception:
            return None
        fans: list[dict[str, Any]] = []
        for chip, entries in (raw or {}).items():
            for idx, entry in enumerate(entries):
                if entry.current and entry.current > 0:
                    label = entry.label or f"{chip} {idx + 1}"
                    fans.append({"name": _short_fan_name(label), "rpm": int(round(entry.current))})
        if not fans:
            return None
        fans.sort(key=_fan_sort_key)
        return {
            "available": True,
            "source": "psutil",
            "cpu_temp_c": None,
            "fans": fans[:6],
        }

    def _loop(self) -> None:
        while True:
            result = self._poll_lhm_http()
            if result is None:
                result = self._poll_lhm_wmi()
            if result is None:
                result = self._poll_psutil_fans()

            if result is not None:
                with self._lock:
                    self._data = result
                time.sleep(1.5 if result["source"] == "lhm-http" else 3.0)
            else:
                with self._lock:
                    self._data = {
                        "available": False,
                        "source": None,
                        "cpu_temp_c": None,
                        "fans": [],
                    }
                time.sleep(5.0)
