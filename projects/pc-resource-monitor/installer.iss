#ifndef AppVersion
  #define AppVersion "1.1.1"
#endif

[Setup]
AppId={{8D6B2A1E-5C3F-4B9E-9A12-515192000001}
AppName=RigTach Metrix
AppVersion={#AppVersion}
AppPublisher=JRAltd
DefaultDirName={localappdata}\Programs\RigTach Metrix
DefaultGroupName=RigTach Metrix
UninstallDisplayIcon={app}\RigTachMetrix.exe
OutputDir=dist
OutputBaseFilename=RigTachMetrix-Setup
SetupIconFile=hud_icon.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
CloseApplications=yes
RestartApplications=yes

[Tasks]
Name: "desktopicon"; Description: "Create a &Desktop shortcut"; GroupDescription: "Additional shortcuts:"
Name: "startupicon"; Description: "Launch automatically when Windows starts"; GroupDescription: "Startup:"; Flags: unchecked

#ifndef BuildDist
  #define BuildDist "dist\RigTachMetrix"
#endif

[Files]
Source: "{#BuildDist}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\RigTach Metrix"; Filename: "{app}\RigTachMetrix.exe"
Name: "{group}\Uninstall RigTach Metrix"; Filename: "{uninstallexe}"
Name: "{autodesktop}\RigTach Metrix"; Filename: "{app}\RigTachMetrix.exe"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "RigTachMetrix"; ValueData: """{app}\RigTachMetrix.exe"""; Flags: uninsdeletevalue; Tasks: startupicon

[Run]
Filename: "{app}\RigTachMetrix.exe"; Description: "Launch RigTach Metrix"; Flags: nowait postinstall skipifsilent
