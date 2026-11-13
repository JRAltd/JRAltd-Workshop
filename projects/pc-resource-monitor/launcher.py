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


def _enable_per_monitor_dpi() -> None:
    """Enable Per-Monitor DPI Awareness v2 so mixed-DPI monitors report true coordinates."""
    if sys.platform != "win32":
        return
    import ctypes

    user32 = ctypes.windll.user32
    try:
        # DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = -4
        user32.SetProcessDpiAwarenessContext(ctypes.c_void_p(-4))
    except Exception:
        try:
            user32.SetProcessDPIAware()
        except Exception:
            pass


def list_windows_monitors() -> list[dict[str, int | bool]]:
    """Return connected monitor rectangles on Windows using Win32 ctypes."""
    if sys.platform != "win32":
        return []

    import ctypes
    from ctypes import wintypes

    _enable_per_monitor_dpi()
    user32 = ctypes.windll.user32

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
    title_substr: str,
    target: dict[str, int | bool],
    borderless: bool = True,
    timeout: float = 8.0,
) -> int | None:
    """Find the launched browser window by title, snap it to target monitor, and return HWND."""
    if sys.platform != "win32":
        return None

    import ctypes
    from ctypes import wintypes

    user32 = ctypes.windll.user32
    SWP_NOZORDER = 0x0004
    SWP_FRAMECHANGED = 0x0020
    SWP_SHOWWINDOW = 0x0040
    SW_RESTORE = 9
    GWL_STYLE = -16
    GWL_EXSTYLE = -20
    WS_CAPTION = 0x00C00000
    WS_THICKFRAME = 0x00040000
    WS_MINIMIZEBOX = 0x00020000
    WS_MAXIMIZEBOX = 0x00010000
    WS_SYSMENU = 0x00080000
    WS_EX_TOOLWINDOW = 0x00000080
    WS_EX_APPWINDOW = 0x00040000
    SW_HIDE = 0
    SW_SHOW = 5

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
            # First move onto target monitor so Windows triggers WM_DPICHANGED if DPI differs
            user32.SetWindowPos(
                hwnd,
                0,
                int(target["x"]),
                int(target["y"]),
                int(target["width"]),
                int(target["height"]),
                SWP_NOZORDER | SWP_SHOWWINDOW,
            )
            time.sleep(0.35)
            if borderless:
                user32.ShowWindow(hwnd, SW_HIDE)
                style = user32.GetWindowLongW(hwnd, GWL_STYLE)
                style &= ~(WS_CAPTION | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU)
                user32.SetWindowLongW(hwnd, GWL_STYLE, style)
                ex_style = user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
                ex_style = (ex_style | WS_EX_TOOLWINDOW) & ~WS_EX_APPWINDOW
                user32.SetWindowLongW(hwnd, GWL_EXSTYLE, ex_style)
            # Re-apply exact monitor rect after WM_DPICHANGED and style strip
            user32.SetWindowPos(
                hwnd,
                0,
                int(target["x"]),
                int(target["y"]),
                int(target["width"]),
                int(target["height"]),
                SWP_NOZORDER | SWP_FRAMECHANGED | SWP_SHOWWINDOW,
            )
            user32.ShowWindow(hwnd, SW_SHOW)
            return hwnd
        time.sleep(0.2)
    return None


def _build_tray_image():
    """Create a crisp dark-telemetry HUD icon using Pillow."""
    from PIL import Image, ImageDraw

    size = 64
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Dark rounded badge
    draw.rounded_rectangle([2, 2, size - 3, size - 3], radius=14, fill=(10, 15, 22, 255), outline=(34, 211, 238, 220), width=3)
    # Telemetry arc & bars
    draw.arc([12, 12, size - 12, size - 12], start=135, end=45, fill=(34, 211, 238, 255), width=5)
    draw.rectangle([22, 36, 27, 48], fill=(16, 185, 129, 255))
    draw.rectangle([30, 28, 35, 48], fill=(34, 211, 238, 255))
    draw.rectangle([38, 32, 43, 48], fill=(56, 189, 248, 255))
    return img


def ensure_ico_file(path: Path) -> Path | None:
    """Save an .ico file for the Windows Desktop shortcut."""
    try:
        img = _build_tray_image()
        img.save(path, format="ICO", sizes=[(64, 64), (32, 32), (16, 16)])
        return path
    except Exception:
        return None


def _run_tray(
    hwnd: int | None,
    target: dict[str, int | bool] | None,
    browser_proc: subprocess.Popen[bytes] | None,
) -> None:
    """Run the Windows System Tray icon (right side of taskbar)."""
    import ctypes
    import pystray

    user32 = ctypes.windll.user32
    SW_HIDE = 0
    SW_SHOW = 5
    WM_CLOSE = 0x0010
    SWP_NOZORDER = 0x0004
    SWP_FRAMECHANGED = 0x0020
    SWP_SHOWWINDOW = 0x0040
    visible = [True]

    def on_toggle(icon, item):
        if not hwnd:
            return
        if visible[0]:
            user32.ShowWindow(hwnd, SW_HIDE)
            visible[0] = False
        else:
            user32.ShowWindow(hwnd, SW_SHOW)
            visible[0] = True

    def on_resnap(icon, item):
        if hwnd and target:
            user32.SetWindowPos(
                hwnd,
                0,
                int(target["x"]),
                int(target["y"]),
                int(target["width"]),
                int(target["height"]),
                SWP_NOZORDER | SWP_FRAMECHANGED | SWP_SHOWWINDOW,
            )
            user32.ShowWindow(hwnd, SW_SHOW)
            visible[0] = True

    def on_quit(icon, item):
        if hwnd:
            user32.PostMessageW(hwnd, WM_CLOSE, 0, 0)
        if browser_proc and browser_proc.poll() is None:
            browser_proc.terminate()
        icon.stop()

    menu = pystray.Menu(
        pystray.MenuItem("Show / Hide HUD", on_toggle, default=True),
        pystray.MenuItem("Re-snap to Monitor", on_resnap),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Quit", on_quit),
    )

    icon = pystray.Icon("pc_resource_monitor", _build_tray_image(), "PC Resource Monitor (515×1920)", menu)
    icon.run()


def main() -> None:
    parser = argparse.ArgumentParser(description="Launch the 515x1920 PC Resource Monitor")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8765, help="Bind port (default: 8765)")
    parser.add_argument("--demo", action="store_true", help="Start in simulated demo mode")
    parser.add_argument("--no-browser", action="store_true", help="Run server only without opening browser")
    parser.add_argument("--no-tray", action="store_true", help="Disable Windows system tray icon")
    parser.add_argument("--kiosk", action="store_true", help="Use --kiosk flag instead of --app window")
    parser.add_argument("--list-monitors", action="store_true", help="List detected Windows monitors and exit")
    parser.add_argument("--make-icon", action="store_true", help="Generate hud_icon.ico and exit")
    args = parser.parse_args()

    if args.make_icon:
        ico_path = Path(__file__).resolve().parent / "hud_icon.ico"
        ensure_ico_file(ico_path)
        print(f"Generated {ico_path}")
        return

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

    from backend.server import app as fastapi_app

    server_thread = threading.Thread(
        target=uvicorn.run,
        args=(fastapi_app,),
        kwargs={"host": args.host, "port": args.port, "log_level": "warning"},
        daemon=True,
    )
    server_thread.start()

    if not wait_for_server(f"http://{args.host}:{args.port}/api/telemetry"):
        print("Failed to start telemetry server.")
        sys.exit(1)

    print(f"PC Resource Monitor running at {url}")

    browser_proc: subprocess.Popen[bytes] | None = None
    target: dict[str, int | bool] | None = None
    hwnd: int | None = None

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
                hwnd = _snap_window_to_monitor("PC Resource Monitor", target)
                if hwnd:
                    print("Snapped HUD window to portrait monitor.")
                else:
                    print(f"Window opened; move it to your portrait monitor or open {url}")
        else:
            print("Edge/Chrome not found. Open the URL manually in your browser:", url)

    if sys.platform == "win32" and not args.no_tray:
        try:
            _run_tray(hwnd, target, browser_proc)
            return
        except Exception as exc:
            print(f"Tray icon unavailable ({exc}); running in console mode.")

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
