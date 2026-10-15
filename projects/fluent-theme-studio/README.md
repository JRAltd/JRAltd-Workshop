# Fluent Theme Studio for Windows 11

A desktop personalization suite designed to create, preview, synthesize, and apply native Windows 11 themes with custom cursors, sounds, color schemes, and desktop icons. Published on the Microsoft Store as **Fluent Theme Studio for Windows 11** (Store ID: `9N24H0Z0PD3K`).

---

## Features

- **Live Windows 11 Workbench Preview**: Real-time visualization of theme settings against simulated Windows 11 desktop, start menu, taskbar, and windows.
- **AI Theme Synthesizer**: Generates matching 4K wallpapers, harmonious system colors, full 15-cursor suite, 10+ sound scheme events, and frosted glass desktop icons based on any chosen accent color.
- **Live 1-Click Native Apply**:
  - Immediately activates custom cursor schemes in Windows (`HKCU\Control Panel\Cursors` & `SPI_SETCURSORS`).
  - Sets desktop icons for *This PC*, *User Files*, *Network*, and *Recycle Bin* via Explorer CLSIDs (`HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\CLSID`).
  - Generates multi-resolution `.ico` binaries (16×16 to 256×256) for crisp high-DPI scaling.
  - Broadcasts `SHChangeNotify` and `WM_SETTINGCHANGE` for instant live updates without rebooting.
- **Native Theme Export**:
  - Export standalone `.theme` INI files adhering to Windows 11 Aero theme specifications.
  - Export compressed `.deskthemepack` cabinet bundles for sharing.

---

## Project Structure

```
fluent-theme-studio/
├── src/
│   ├── app.py                   # Python backend server (pywebview + HTTP bridge)
│   └── static/                  # Modern Tailwind CSS + Vanilla JS frontend
│       ├── css/styles.css
│       ├── js/app.js            # Main application controller
│       ├── js/ai_cursors.js     # Canvas-based 15-cursor suite generator
│       ├── js/ai_icons.js       # Glassmorphism desktop icon synthesizer
│       ├── js/ai_audio.js       # Web Audio API procedural sound synthesizer
│       ├── js/color_picker.js   # Palette extraction & color converters
│       ├── js/preview.js        # Live desktop preview renderer
│       ├── js/exporter.js       # .theme & .deskthemepack generator
│       ├── favicon.ico
│       └── index.html
├── packaging/                   # MSIX packaging assets and manifest
│   ├── AppxManifest.xml         # Package manifest for Microsoft Store
│   ├── Assets/                  # Store logos and application tiles
│   ├── build_msix.ps1           # Automated MSIX build script
│   ├── Registry.dat
│   ├── Resources.pri
│   ├── User.dat
│   └── UserClasses.dat
├── .gitignore
└── README.md
```

---

## Running Locally

### Prerequisites

- Python 3.12+ (or 3.14)
- Dependencies:
  ```powershell
  pip install pywebview pillow pywin32 pyinstaller
  ```

### Launch Development Server

```powershell
python src/app.py
```

This launches the native desktop window using `pywebview` (or opens your default web browser if webview isn't available).

---

## Building the MSIX Package for Microsoft Store

To create a new `.msix` package ready to submit to Microsoft Partner Center:

```powershell
pwsh packaging/build_msix.ps1 -Version "1.0.2.0"
```

The output package will be generated under `out/FluentThemeStudio_1.0.2.0_x64.msix`.
