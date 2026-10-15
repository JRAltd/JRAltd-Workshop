# Fluent Theme Studio for Windows 11 — Project Context & History

This document preserves the context, architecture, bug fixes, and development history from the session where Fluent Theme Studio for Windows 11 was updated and prepared for Microsoft Store submission.

---

## Background & Origin

- **App Identity:** `JRAltdInc.Windows11ThemeGenerator`
- **Store Product ID:** `9N24H0Z0PD3K`
- **Publisher:** `JRAltd_Inc` (`CN=B5A5A495-8A06-4513-9CCE-C33BE9123C3F`)
- **Technology Stack:**
  - **Backend:** Python 3.12/3.14 (`http.server`, `socketserver`, `pywebview`, `ctypes`, `winreg`, `PIL`, `subprocess`)
  - **Frontend:** Vanilla JS + Tailwind CSS (bundled under `src/static/`)
  - **Packaging:** MSIX Desktop Bridge (`VFS\UserProgramFiles\...`) compiled via `makeappx.exe`

---

## Core Bug Fixes Applied (v1.0.2.0)

### 1. Windows Desktop Icon Application
- **Issue:** Previously, desktop icons for *This PC*, *User Files*, *Network*, and *Recycle Bin* were generated but never written to the Windows Registry. Windows Explorer only updates desktop icons when the respective CLSIDs are modified in `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\CLSID`.
- **Fix in `src/app.py`:**
  - Desktop icons are converted to multi-layer high-DPI `.ico` files containing resolutions `16x16`, `24x24`, `32x32`, `48x48`, `64x64`, `128x128`, and `256x256`.
  - Keys are explicitly written to:
    - `{20D04FE0-3AEA-1069-A2D8-08002B30309D}\DefaultIcon` (This PC)
    - `{59031A47-3F72-44A7-89C5-5595FE6B30EE}\DefaultIcon` (User Files)
    - `{F02C1A0D-BE21-4350-88B0-7367FC96EF3C}\DefaultIcon` (Network)
    - `{645FF040-5081-101B-9F08-00AA002F954E}\DefaultIcon` (Recycle Bin `empty` and `full`)
  - Windows Shell notification `SHChangeNotify(SHCNE_ASSOCCHANGED, 0, None, None)` (0x08000000) is fired, and `Progman` / desktop windows are redrawn to force immediate explorer update without rebooting.

### 2. Cursor Scheme Activation
- **Issue:** When applying directly to Windows, `src/static/js/exporter.js` generated `.theme` INI text with empty cursor paths (`Arrow=`), causing Windows to reset cursors to default Aero. Furthermore, the backend only called `SetSystemCursor` in-memory without invoking `SystemParametersInfoW` to reload cursors system-wide.
- **Fix in `src/static/js/exporter.js` & `src/app.py`:**
  - `generateThemeIni()` in `exporter.js` always outputs relative placeholder paths (`Cursors\arrow.cur`) so the backend can resolve them to absolute asset paths.
  - In `app.py`, cursors are written to `HKCU\Control Panel\Cursors` and `HKCU\Control Panel\Cursors\Schemes`.
  - Live cursor activation calls `SystemParametersInfoW(SPI_SETCURSORS, 0, None, SPIF_UPDATEINIFILE | SPIF_SENDCHANGE)` (87, 0, None, 3) and broadcasts `WM_SETTINGCHANGE` (`0x001A`) to all top-level windows.

---

## Packaging & Deployment

- **Automated Script:** `packaging/build_msix.ps1`
  - Rebuilds PyInstaller standalone executable.
  - Updates version in `AppxManifest.xml`.
  - Assembles MSIX VFS directory.
  - Runs `makeappx pack` to output ready-to-upload `.msix` file.
- **Microsoft Store Upload:** Upload output `.msix` to Microsoft Partner Center dashboard under **Fluent Theme Studio for Windows 11** -> **Packages**.
