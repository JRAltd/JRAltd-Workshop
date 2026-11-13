"""Real-time PC telemetry collection and realistic demo data generator."""

from __future__ import annotations

import math
import os
import platform
import random
import shutil
import socket
import subprocess
import time
from typing import Any

import psutil


def _bytes_to_gb(value: int | float) -> float:
    return round(value / (1024**3), 2)


def _get_local_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.settimeout(0.2)
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def _get_cpu_model() -> str:
    proc = platform.processor()
    if platform.system() == "Linux":
        try:
            with open("/proc/cpuinfo", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("model name"):
                        return line.split(":", 1)[1].strip()
        except OSError:
            pass
    return proc or platform.machine() or "Unknown CPU"


class SystemTelemetryCollector:
    """Collects live CPU, GPU, RAM, Disk, Network, and Process metrics."""

    def __init__(self) -> None:
        self._last_time = time.monotonic()
        self._last_net = psutil.net_io_counters()
        self._last_disk = psutil.disk_io_counters()
        self._nvidia_smi = shutil.which("nvidia-smi")
        self._cpu_model = _get_cpu_model()
        self._hostname = socket.gethostname()
        self._os_label = f"{platform.system()} {platform.release()}"
        # Prime cpu_percent so the first real call returns valid deltas
        psutil.cpu_percent(interval=None, percpu=True)

    def _read_cpu_temp(self) -> float | None:
        if hasattr(psutil, "sensors_temperatures"):
            try:
                temps = psutil.sensors_temperatures()
                for key in ("k10temp", "coretemp", "zenpower", "cpu_thermal", "acpitz"):
                    if key in temps and temps[key]:
                        return round(temps[key][0].current, 1)
                for entries in temps.values():
                    if entries:
                        return round(entries[0].current, 1)
            except Exception:
                pass
        return None

    def _read_nvidia_gpu(self) -> dict[str, Any] | None:
        if not self._nvidia_smi:
            return None
        try:
            cmd = [
                self._nvidia_smi,
                "--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,power.limit,clocks.current.graphics,clocks.current.memory,fan.speed",
                "--format=csv,noheader,nounits",
            ]
            # Hide console window on Windows
            kwargs: dict[str, Any] = {
                "capture_output": True,
                "text": True,
                "timeout": 1.5,
            }
            if os.name == "nt":
                kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW  # type: ignore[attr-defined]
            res = subprocess.run(cmd, **kwargs)
            if res.returncode != 0 or not res.stdout.strip():
                return None

            line = res.stdout.strip().splitlines()[0]
            parts = [p.strip() for p in line.split(",")]
            if len(parts) < 10:
                return None

            def _num(val: str) -> float | None:
                if val in ("", "[N/A]", "N/A", "[Not Supported]"):
                    return None
                try:
                    return float(val)
                except ValueError:
                    return None

            vram_used_mb = _num(parts[2]) or 0.0
            vram_total_mb = _num(parts[3]) or 1.0
            return {
                "available": True,
                "name": parts[0],
                "usage_percent": round(_num(parts[1]) or 0.0, 1),
                "vram_used_gb": round(vram_used_mb / 1024.0, 2),
                "vram_total_gb": round(vram_total_mb / 1024.0, 2),
                "vram_percent": round((vram_used_mb / vram_total_mb) * 100.0, 1),
                "temp_c": _num(parts[4]),
                "power_w": _num(parts[5]),
                "power_limit_w": _num(parts[6]),
                "clock_mhz": _num(parts[7]),
                "mem_clock_mhz": _num(parts[8]),
                "fan_percent": _num(parts[9]),
            }
        except Exception:
            return None

    def _read_disks(self) -> list[dict[str, Any]]:
        drives: list[dict[str, Any]] = []
        seen_mounts: set[str] = set()
        for part in psutil.disk_partitions(all=False):
            if part.mountpoint in seen_mounts:
                continue
            if os.name != "nt" and part.fstype in ("squashfs", "tmpfs", "devtmpfs", "overlay"):
                continue
            if os.name == "nt" and "cdrom" in part.opts.lower():
                continue
            try:
                usage = psutil.disk_usage(part.mountpoint)
            except (PermissionError, OSError):
                continue
            if usage.total <= 0:
                continue
            seen_mounts.add(part.mountpoint)
            label = part.mountpoint.rstrip("\\") if os.name == "nt" else part.mountpoint
            drives.append(
                {
                    "mount": label,
                    "fs": part.fstype or "NTFS",
                    "used_gb": _bytes_to_gb(usage.used),
                    "total_gb": _bytes_to_gb(usage.total),
                    "free_gb": _bytes_to_gb(usage.free),
                    "percent": round(usage.percent, 1),
                }
            )
        return drives[:4]

    def _read_top_processes(self, sort_by: str = "cpu", limit: int = 5) -> list[dict[str, Any]]:
        procs: list[dict[str, Any]] = []
        logical_cores = psutil.cpu_count(logical=True) or 1
        for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_info"]):
            try:
                info = p.info
                if info["pid"] == 0 or not info["name"]:
                    continue
                cpu_val = (info["cpu_percent"] or 0.0) / logical_cores
                mem_mb = ((info["memory_info"].rss if info["memory_info"] else 0) / (1024**2))
                procs.append(
                    {
                        "pid": info["pid"],
                        "name": info["name"],
                        "cpu_percent": round(min(cpu_val, 100.0), 1),
                        "ram_mb": round(mem_mb, 1),
                    }
                )
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue

        key = "ram_mb" if sort_by == "ram" else "cpu_percent"
        procs.sort(key=lambda item: item[key], reverse=True)
        return procs[:limit]

    def collect(self, sort_by: str = "cpu") -> dict[str, Any]:
        now = time.monotonic()
        dt = max(now - self._last_time, 0.1)
        self._last_time = now

        # CPU
        per_core = [round(c, 1) for c in psutil.cpu_percent(interval=None, percpu=True)]
        cpu_total = round(sum(per_core) / max(len(per_core), 1), 1)
        freq = psutil.cpu_freq()
        cpu_ghz = round((freq.current / 1000.0), 2) if freq else None

        # Memory
        vm = psutil.virtual_memory()
        swap = psutil.swap_memory()

        # Network I/O
        net = psutil.net_io_counters()
        rx_bps = max(0.0, (net.bytes_recv - self._last_net.bytes_recv) / dt)
        tx_bps = max(0.0, (net.bytes_sent - self._last_net.bytes_sent) / dt)
        self._last_net = net

        # Disk I/O
        disk_io = psutil.disk_io_counters()
        read_bps = 0.0
        write_bps = 0.0
        if disk_io and self._last_disk:
            read_bps = max(0.0, (disk_io.read_bytes - self._last_disk.read_bytes) / dt)
            write_bps = max(0.0, (disk_io.write_bytes - self._last_disk.write_bytes) / dt)
        self._last_disk = disk_io

        # GPU
        gpu = self._read_nvidia_gpu() or {
            "available": False,
            "name": "No NVIDIA GPU Detected",
            "usage_percent": 0.0,
            "vram_used_gb": 0.0,
            "vram_total_gb": 0.0,
            "vram_percent": 0.0,
            "temp_c": None,
            "power_w": None,
            "power_limit_w": None,
            "clock_mhz": None,
            "mem_clock_mhz": None,
            "fan_percent": None,
        }

        uptime_sec = int(time.time() - psutil.boot_time())

        return {
            "mode": "live",
            "timestamp": time.time(),
            "system": {
                "hostname": self._hostname,
                "os": self._os_label,
                "uptime_sec": uptime_sec,
                "ip": _get_local_ip(),
            },
            "cpu": {
                "name": self._cpu_model,
                "usage_percent": cpu_total,
                "per_core": per_core,
                "cores": psutil.cpu_count(logical=False) or len(per_core),
                "threads": len(per_core),
                "freq_ghz": cpu_ghz,
                "temp_c": self._read_cpu_temp(),
            },
            "gpu": gpu,
            "memory": {
                "used_gb": _bytes_to_gb(vm.used),
                "total_gb": _bytes_to_gb(vm.total),
                "available_gb": _bytes_to_gb(vm.available),
                "percent": round(vm.percent, 1),
                "swap_used_gb": _bytes_to_gb(swap.used),
                "swap_total_gb": _bytes_to_gb(swap.total),
            },
            "network": {
                "rx_bps": round(rx_bps, 1),
                "tx_bps": round(tx_bps, 1),
                "total_rx_gb": _bytes_to_gb(net.bytes_recv),
                "total_tx_gb": _bytes_to_gb(net.bytes_sent),
            },
            "storage": {
                "read_bps": round(read_bps, 1),
                "write_bps": round(write_bps, 1),
                "drives": self._read_disks(),
            },
            "processes": self._read_top_processes(sort_by=sort_by, limit=5),
        }


class DemoTelemetryGenerator:
    """Generates smooth, realistic PC telemetry for previewing the 515x1920 HUD."""

    def __init__(self) -> None:
        self._tick = 0
        self._cpu = 34.0
        self._gpu = 58.0
        self._ram = 22.4
        self._rx = 18_500_000.0
        self._tx = 2_400_000.0
        self._cores = [25.0 + random.uniform(0, 35) for _ in range(16)]
        self._procs = [
            {"pid": 14280, "name": "Cyberpunk2077.exe", "cpu_percent": 18.4, "ram_mb": 6840.0},
            {"pid": 8844, "name": "chrome.exe", "cpu_percent": 6.2, "ram_mb": 2140.0},
            {"pid": 4120, "name": "obs64.exe", "cpu_percent": 4.9, "ram_mb": 1120.0},
            {"pid": 9204, "name": "Discord.exe", "cpu_percent": 2.1, "ram_mb": 640.0},
            {"pid": 3188, "name": "Code.exe", "cpu_percent": 1.6, "ram_mb": 890.0},
            {"pid": 1044, "name": "dwm.exe", "cpu_percent": 1.2, "ram_mb": 210.0},
        ]

    @staticmethod
    def _walk(val: float, low: float, high: float, step: float) -> float:
        return max(low, min(high, val + random.uniform(-step, step)))

    def collect(self, sort_by: str = "cpu") -> dict[str, Any]:
        self._tick += 1
        wave = math.sin(self._tick * 0.25) * 6.0

        self._cpu = self._walk(self._cpu, 12.0, 88.0, 5.5)
        cpu_now = round(max(5.0, min(98.0, self._cpu + wave * 0.5)), 1)

        self._cores = [
            round(self._walk(c, max(4.0, cpu_now - 22), min(99.0, cpu_now + 28), 11.0), 1)
            for c in self._cores
        ]

        self._gpu = self._walk(self._gpu, 18.0, 96.0, 6.5)
        gpu_now = round(max(8.0, min(99.0, self._gpu + wave * 0.7)), 1)

        self._ram = self._walk(self._ram, 18.0, 48.0, 0.35)
        ram_total = 64.0
        ram_pct = round((self._ram / ram_total) * 100.0, 1)

        self._rx = self._walk(self._rx, 150_000.0, 85_000_000.0, 9_500_000.0)
        self._tx = self._walk(self._tx, 60_000.0, 14_000_000.0, 1_800_000.0)

        procs = []
        for p in self._procs:
            procs.append(
                {
                    "pid": p["pid"],
                    "name": p["name"],
                    "cpu_percent": round(max(0.2, p["cpu_percent"] + random.uniform(-1.4, 1.4)), 1),
                    "ram_mb": round(max(50.0, p["ram_mb"] + random.uniform(-18.0, 18.0)), 1),
                }
            )
        key = "ram_mb" if sort_by == "ram" else "cpu_percent"
        procs.sort(key=lambda item: item[key], reverse=True)

        return {
            "mode": "demo",
            "timestamp": time.time(),
            "system": {
                "hostname": "WORKSTATION-01",
                "os": "Windows 11 Pro",
                "uptime_sec": 184_320 + self._tick,
                "ip": "192.168.1.42",
            },
            "cpu": {
                "name": "AMD Ryzen 9 7950X 16-Core",
                "usage_percent": cpu_now,
                "per_core": self._cores,
                "cores": 16,
                "threads": 16,
                "freq_ghz": round(4.65 + (cpu_now / 100.0) * 0.85, 2),
                "temp_c": round(46.0 + (cpu_now * 0.34), 1),
            },
            "gpu": {
                "available": True,
                "name": "NVIDIA GeForce RTX 4080",
                "usage_percent": gpu_now,
                "vram_used_gb": round(6.8 + (gpu_now / 100.0) * 5.2, 2),
                "vram_total_gb": 16.0,
                "vram_percent": round(((6.8 + (gpu_now / 100.0) * 5.2) / 16.0) * 100.0, 1),
                "temp_c": round(44.0 + (gpu_now * 0.31), 1),
                "power_w": round(65.0 + (gpu_now * 2.35), 1),
                "power_limit_w": 320.0,
                "clock_mhz": round(1850 + (gpu_now * 7.5)),
                "mem_clock_mhz": 11200,
                "fan_percent": round(32 + (gpu_now * 0.45)),
            },
            "memory": {
                "used_gb": round(self._ram, 2),
                "total_gb": ram_total,
                "available_gb": round(ram_total - self._ram, 2),
                "percent": ram_pct,
                "swap_used_gb": 1.4,
                "swap_total_gb": 16.0,
            },
            "network": {
                "rx_bps": round(self._rx, 1),
                "tx_bps": round(self._tx, 1),
                "total_rx_gb": 142.8,
                "total_tx_gb": 28.4,
            },
            "storage": {
                "read_bps": round(random.uniform(12_000_000, 145_000_000), 1),
                "write_bps": round(random.uniform(4_000_000, 68_000_000), 1),
                "drives": [
                    {
                        "mount": "C:",
                        "fs": "NTFS",
                        "used_gb": 612.4,
                        "total_gb": 931.5,
                        "free_gb": 319.1,
                        "percent": 65.7,
                    },
                    {
                        "mount": "D:",
                        "fs": "NTFS",
                        "used_gb": 1180.0,
                        "total_gb": 1863.0,
                        "free_gb": 683.0,
                        "percent": 63.3,
                    },
                ],
            },
            "processes": procs[:5],
        }
