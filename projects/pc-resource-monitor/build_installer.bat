@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    python -m venv .venv
    if errorlevel 1 (
        echo Python 3.10+ is required to build the installer.
        pause
        exit /b 1
    )
)

echo [1/3] Installing build dependencies (PyInstaller)...
".venv\Scripts\pip.exe" install -q -r requirements.txt pyinstaller
".venv\Scripts\python.exe" launcher.py --make-icon

echo [2/3] Building standalone PCResourceMonitor.exe...
".venv\Scripts\pyinstaller.exe" --noconfirm --onedir --windowed ^
    --workpath "%TEMP%\pcrm-build-%RANDOM%" ^
    --name PCResourceMonitor ^
    --icon hud_icon.ico ^
    --add-data "frontend;frontend" ^
    --collect-all webview ^
    --collect-all pythonnet ^
    --collect-all clr_loader ^
    --hidden-import uvicorn.logging ^
    --hidden-import uvicorn.loops.auto ^
    --hidden-import uvicorn.protocols.http.auto ^
    --hidden-import uvicorn.protocols.websockets.auto ^
    --hidden-import uvicorn.lifespan.on ^
    --hidden-import pystray._win32 ^
    launcher.py

if errorlevel 1 (
    echo PyInstaller build failed.
    pause
    exit /b 1
)

echo [3/3] Checking for Inno Setup (iscc.exe)...
set "ISCC="
if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles%\Inno Setup 6\ISCC.exe"
if exist "%LocalAppData%\Programs\Inno Setup 6\ISCC.exe" set "ISCC=%LocalAppData%\Programs\Inno Setup 6\ISCC.exe"

if "%ISCC%"=="" (
    echo Inno Setup 6 not found. Installing via winget...
    winget install --id JRSoftware.InnoSetup -e --silent --accept-package-agreements --accept-source-agreements
    if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
    if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles%\Inno Setup 6\ISCC.exe"
    if exist "%LocalAppData%\Programs\Inno Setup 6\ISCC.exe" set "ISCC=%LocalAppData%\Programs\Inno Setup 6\ISCC.exe"
)

if not "%ISCC%"=="" (
    "%ISCC%" installer.iss
    echo.
    echo ============================================================
    echo Installer ready: dist\PCResourceMonitor-Setup.exe
    echo ============================================================
) else (
    echo.
    echo Standalone app built at: dist\PCResourceMonitor\PCResourceMonitor.exe
    echo To build Setup.exe, install Inno Setup 6 and run: iscc installer.iss
)

pause
