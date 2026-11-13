"""Windows-ready launcher for the 515x1920 PC Resource Monitor HUD."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from pathlib import Path

import uvicorn


def list_windows_monitors() -> list[dict[str, int | bool]]:
    """Return connected monitor rectangles on Windows using Win32 ctypes."""
    if sys.platform != "win32":
        return []

    import ctypes
    from ctypes import wintypes

    user32 = ctypes.windll.user32
    try:
        user32.SetProcessDPIAware()
    except Exception:
        pass

    class RECT(ctypes.Structure):
        _fields_ = [
            ("left", ctypes.c_long),
            ("top", ctypes.c_long),
            ("right", ctypes.c_long),
            ("bottom", ctypes.c_long),
        ]

    class MONITORINFO(ctypes.Structure):
        _fields_ = [
            ("cbSize", wintypes.DWORD),
            ("rcMonitor", RECT),
            ("rcWork", RECT),
            ("dwFlags", wintypes.DWORD),
        ]

    monitors: list[dict[str, int | bool]] = []

    MONITORENUMPROC = ctypes.WINFUNCTYPE(
        wintypes.BOOL,
        wintypes.HMONITOR,
        wintypes.HDC,
        ctypes.POINTER(RECT),
        wintypes.LPARAM,
    )

    def _callback(hMonitor, hdcMonitor, lprcMonitor, dwData):
        info = MONITORINFO()
        info.cbSize = ctypes.sizeof(MONITORINFO)
        if user32.GetMonitorInfoW(hMonitor, ctypes.byref(info)):
            r = info.rcMonitor
            monitors.append(
                {
                    "x": r.left,
                    "y": r.top,
                    "width": r.right - r.left,
                    "height": r.bottom - r.top,
                    "primary": bool(info.dwFlags & 1),
                }
            )
        return True

    user32.EnumDisplayMonitors(0, 0, MONITORENUMPROC(_callback), 0)
    return monitors


def find_browser() -> str | None:
    """Locate Microsoft Edge or Google Chrome on Windows/Linux."""
    candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    for name in ("msedge", "chrome", "google-chrome", "chromium"):
        found = shutil.which(name)
        if found:
            return found
    return None


def wait_for_server(url: str, timeout: float = 10.0) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=0.5) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.15)
    return False


def _snap_window_to_monitor(
    title_substr: str, target: dict[str, int | bool], timeout: float = 8.0
) -> bool:
    """Find the launched browser window by title and snap it to the target monitor."""
    if sys.platform != "win32":
        return False

    import ctypes
    from ctypes import wintypes

    user32 = ctypes.windll.user32
    SWP_NOZORDER = 0x0004
    SWP_SHOWWINDOW = 0x0040
    SW_RESTORE = 9

    found_hwnd: list[int] = []
    WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def _enum_cb(hwnd, lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        length = user32.GetWindowTextLengthW(hwnd)
        if length > 0:
            buf = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buf, length + 1)
            if title_substr in buf.value:
                found_hwnd.append(hwnd)
                return False
        return True

    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        found_hwnd.clear()
        user32.EnumWindows(WNDENUMPROC(_enum_cb), 0)
        if found_hwnd:
            hwnd = found_hwnd[0]
            user32.ShowWindow(hwnd, SW_RESTORE)
            user32.SetWindowPos(
                hwnd,
                0,
                int(target["x"]),
                int(target["y"]),
                int(target["width"]),
                int(target["height"]),
                SWP_NOZORDER | SWP_SHOWWINDOW,
            )
            return True
        time.sleep(0.2)
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Launch the 515x1920 PC Resource Monitor")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8765, help="Bind port (default: 8765)")
    parser.add_argument("--demo", action="store_true", help="Start in simulated demo mode")
    parser.add_argument("--no-browser", action="store_true", help="Run server only without opening browser")
    parser.add_argument("--kiosk", action="store_true", help="Use --kiosk flag instead of --app window")
    parser.add_argument("--list-monitors", action="store_true", help="List detected Windows monitors and exit")
    args = parser.parse_args()

    if args.list_monitors:
        mons = list_windows_monitors()
        if not mons:
            print("No Windows monitors detected (or not running on Windows).")
        for idx, m in enumerate(mons):
            tag = " [PRIMARY]" if m["primary"] else ""
            print(f"Monitor {idx}: {m['width']}x{m['height']} at ({m['x']}, {m['y']}){tag}")
        return

    if args.demo:
        os.environ["RESOURCE_MONITOR_DEMO"] = "1"

    url = f"http://{args.host}:{args.port}/"
    if args.demo:
        url += "?demo=1"

    server_thread = threading.Thread(
        target=uvicorn.run,
        args=("backend.server:app",),
        kwargs={"host": args.host, "port": args.port, "log_level": "warning"},
        daemon=True,
    )
    server_thread.start()

    if not wait_for_server(f"http://{args.host}:{args.port}/api/telemetry"):
        print("Failed to start telemetry server.")
        sys.exit(1)

    print(f"PC Resource Monitor running at {url}")

    browser_proc: subprocess.Popen[bytes] | None = None
    if not args.no_browser:
        browser = find_browser()
        if browser:
            monitors = list_windows_monitors()
            target = next(
                (m for m in monitors if m["width"] == 515 and m["height"] == 1920),
                next((m for m in monitors if m["width"] < m["height"]), None),
            )
            profile_dir = Path(tempfile.gettempdir()) / "pc-resource-monitor-profile"
            profile_dir.mkdir(parents=True, exist_ok=True)

            cmd = [
                browser,
                f"--user-data-dir={profile_dir}",
                "--no-first-run",
                "--no-default-browser-check",
                "--new-window",
            ]
            if args.kiosk:
                cmd.extend(["--kiosk", url])
            else:
                cmd.append(f"--app={url}")

            if target:
                print(
                    f"Detected {target['width']}x{target['height']} monitor at ({target['x']}, {target['y']})"
                )
            else:
                cmd.append("--window-size=515,1920")

            browser_proc = subprocess.Popen(cmd)
            if target:
                if _snap_window_to_monitor("PC Resource Monitor", target):
                    print("Snapped HUD window to portrait monitor.")
                else:
                    print(f"Window opened; move it to your portrait monitor or open {url}")
        else:
            print("Edge/Chrome not found. Open the URL manually in your browser:", url)

    try:
        if browser_proc:
            browser_proc.wait()
        else:
            while True:
                time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down PC Resource Monitor...")


if __name__ == "__main__":
    main()
