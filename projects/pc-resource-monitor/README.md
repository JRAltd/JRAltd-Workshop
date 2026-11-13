# PC Resource Monitor (`515 × 1920`)

A sleek dark telemetry HUD purpose-built for narrow `515 × 1920` portrait secondary monitors on Windows 10/11.

## Features

- **Exact `515 × 1920` Portrait Layout** — Zero scrollbars, crisp `1:1` pixel fit, and automatic viewport scaling when previewed on a standard desktop monitor.
- **Live Hardware Telemetry (1 Hz WebSocket)**:
  - **CPU**: Total load arc gauge, 60-second sparkline, clock speed (GHz), package temp (when exposed by OS/sensors), and per-thread load bars.
  - **GPU**: NVIDIA GPU core load arc gauge, VRAM allocation bar, temperature, power draw (W), core clock, and fan speed via `nvidia-smi`.
  - **Memory**: Used/total RAM, available memory, pagefile usage, and 60-second sparkline.
  - **Network I/O**: Real-time download/upload speeds with dual-line sparkline and session totals.
  - **Storage & Disk I/O**: Live read/write MB/s and per-drive capacity bars.
  - **Top Processes**: Top 5 processes sortable by CPU % or RAM.
- **Automatic Windows Monitor Placement** — `launcher.py` uses Win32 `EnumDisplayMonitors` to locate your `515 × 1920` display and opens Microsoft Edge or Chrome in frameless `--app` mode directly on that screen.
- **Demo Mode** — Preview the HUD with simulated telemetry using `--demo` or the gear menu in the top-right corner.

## Quick Start (Windows 10 / 11)

1. Ensure **Python 3.10+** is installed and on `PATH`.
2. Double-click `start_monitor.bat` (or run from PowerShell/CMD):

```bat
start_monitor.bat
```

### Useful Flags

```bat
:: Preview with simulated hardware data
start_monitor.bat --demo

:: Launch in fullscreen kiosk mode on the 515x1920 monitor
start_monitor.bat --kiosk

:: List detected Windows monitor coordinates
start_monitor.bat --list-monitors

:: Run the server without launching a browser window
start_monitor.bat --no-browser
```

## Manual Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python launcher.py
```

Open `http://127.0.0.1:8765` (or `http://127.0.0.1:8765/?demo=1` for demo mode).
