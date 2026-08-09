; Inno Setup script for JRAltd Inc Program Updater.
; Compile with Inno Setup (https://jrsoftware.org/isinfo.php) after publishing the
; app -- see packaging/README.md for the full build-and-package steps.

#define MyAppName "JRAltd Inc Program Updater"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "JRAltd Inc"
#define MyAppURL "https://jraltdinc.us/"
#define MyAppExeName "JRAltdIncProgramUpdater.exe"

[Setup]
; Generated once for this app; keep it stable across releases so Windows treats
; upgrades as upgrades rather than a separate install. Do not reuse this GUID for a
; different app.
AppId={{191A2E21-52EC-4CE6-8E0A-235B88B6341C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
; The app's own manifest already requires admin at launch (it shells out to winget,
; which needs admin for most real-world upgrades); the installer needs admin too
; since it writes to Program Files.
PrivilegesRequired=admin
OutputDir=Output
OutputBaseFilename=JRAltdIncProgramUpdaterSetup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
; Everything dotnet publish produced -- see packaging/README.md for the publish
; command. Wildcarded rather than naming individual files since a self-contained
; single-file publish can still leave a few side files (e.g. a .pdb) alongside the
; main exe.
Source: "publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent
