# Packaging a distributable installer

Two options, from simplest to most polished. Both start from the same `dotnet
publish` step.

## 1. Publish a self-contained executable

From `src/JRAltdIncProgramUpdater/`, in PowerShell (one line — PowerShell's
line-continuation character is a backtick `` ` ``, not `^`, which is cmd.exe-only):

```powershell
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o ..\..\packaging\publish
```

Or, if you'd rather split it across lines in PowerShell, use backticks instead of `^`:

```powershell
dotnet publish -c Release -r win-x64 --self-contained true `
  -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true `
  -o ..\..\packaging\publish
```

- `--self-contained true` bundles the .NET 8 runtime into the output, so people
  installing this **don't need .NET installed** on their PC at all.
- `-p:PublishSingleFile=true` collapses the output into (essentially) one exe
  instead of a folder of DLLs.
- `-r win-x64` targets 64-bit Windows. Use `win-x86` instead if you specifically
  need 32-bit support (unlikely for a modern target machine).

This produces `packaging\publish\JRAltdIncProgramUpdater.exe` (self-contained,
~150 MB since it carries the whole runtime).

## Option A: hand out the exe directly (no installer)

For casual/internal distribution, `JRAltdIncProgramUpdater.exe` from the publish
step above is already runnable on its own — no install step, just copy it
anywhere and double-click. Downsides: no Start Menu entry, no uninstaller, no
version tracking; each update means replacing the file manually.

## Option B: build a proper installer with Inno Setup

Gives recipients a normal Windows install wizard: license/progress screens, a
Start Menu entry, an optional desktop shortcut, and an uninstaller listed in
"Add or Remove Programs".

1. Install [Inno Setup](https://jrsoftware.org/isinfo.php) (free) on your Windows
   machine.
2. Run the publish command above so `packaging\publish\` is populated.
3. Open `packaging\setup.iss` in Inno Setup and click **Compile** (or run
   `ISCC.exe packaging\setup.iss` from the command line).
4. Output lands at `packaging\Output\JRAltdIncProgramUpdaterSetup.exe` — this is
   the file you hand out. Running it walks the user through a normal install:
   picks a folder under Program Files, adds Start Menu/desktop shortcuts, and
   registers an uninstaller.

`setup.iss` already sets `PrivilegesRequired=admin` (needed since it writes to
Program Files) and points at `JRAltdIncProgramUpdater.exe` as the app's entry
point. Bump `MyAppVersion` in `setup.iss` before each new release.

## Heads-up: unsigned binaries and SmartScreen

Neither the exe nor the installer is code-signed. The first time someone runs
either on their own PC, Windows SmartScreen will very likely show **"Windows
protected your PC"** with the app listed as an unrecognized publisher. They can
get past it via **More info → Run anyway** — this is expected for any
unsigned indie app, not a sign something's broken.

If you want to get rid of that warning for recipients, the only real fix is
purchasing a code-signing certificate from a CA (e.g. DigiCert, Sectigo) and
signing both the exe and the installer with `signtool.exe` — that costs money
and requires identity verification, so it's not something set up here. Worth
doing eventually if this is going to wider/less technical users; not necessary
for sharing with people who trust the source.
