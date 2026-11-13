@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    python -m venv .venv
    if errorlevel 1 (
        echo Python 3.10+ is required and must be on PATH.
        pause
        exit /b 1
    )
)

".venv\Scripts\pip.exe" install -q -r requirements.txt
".venv\Scripts\python.exe" launcher.py --make-icon

powershell -NoProfile -Command ^
  "$WshShell = New-Object -ComObject WScript.Shell; ^
   $Desktop = [Environment]::GetFolderPath('Desktop'); ^
   $Shortcut = $WshShell.CreateShortcut((Join-Path $Desktop 'PC Resource Monitor.lnk')); ^
   $Shortcut.TargetPath = '%~dp0start_monitor_silent.vbs'; ^
   $Shortcut.WorkingDirectory = '%~dp0'; ^
   $Shortcut.IconLocation = '%~dp0hud_icon.ico'; ^
   $Shortcut.Description = 'Launch 515x1920 PC Resource Monitor HUD'; ^
   $Shortcut.Save()"

echo.
echo Created "PC Resource Monitor" shortcut on your Desktop!
pause
