[Setup]
AppId={{8D6B2A1E-5C3F-4B9E-9A12-515192000001}
AppName=PC Resource Monitor
AppVersion=1.0.0
AppPublisher=JRAltd
DefaultDirName={localappdata}\Programs\PC Resource Monitor
DefaultGroupName=PC Resource Monitor
UninstallDisplayIcon={app}\PCResourceMonitor.exe
OutputDir=dist
OutputBaseFilename=PCResourceMonitor-Setup
SetupIconFile=hud_icon.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest

[Tasks]
Name: "desktopicon"; Description: "Create a &Desktop shortcut"; GroupDescription: "Additional shortcuts:"
Name: "startupicon"; Description: "Launch automatically when Windows starts"; GroupDescription: "Startup:"; Flags: unchecked

[Files]
Source: "dist\PCResourceMonitor\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\PC Resource Monitor"; Filename: "{app}\PCResourceMonitor.exe"
Name: "{group}\Uninstall PC Resource Monitor"; Filename: "{uninstallexe}"
Name: "{autodesktop}\PC Resource Monitor"; Filename: "{app}\PCResourceMonitor.exe"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "PCResourceMonitor"; ValueData: """{app}\PCResourceMonitor.exe"""; Flags: uninsdeletevalue; Tasks: startupicon

[Run]
Filename: "{app}\PCResourceMonitor.exe"; Description: "Launch PC Resource Monitor"; Flags: nowait postinstall skipifsilent
