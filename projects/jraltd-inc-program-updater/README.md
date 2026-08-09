# JRAltd Inc Program Updater

A Windows desktop app that checks for and applies system/package updates via
[WinGet](https://learn.microsoft.com/windows/package-manager/winget/) (the Windows
Package Manager). Styled to match [jraltdinc.us](https://jraltdinc.us/) — dark navy
background, cyan accents, card-style layout, Segoe UI.

## Status

WinGet integration, elevation handling, a styled UI, per-package skip/ignore, and
scheduled auto-checks are implemented. **Not build-verified** — this was written in a
Linux dev session. WPF apps only build/run on Windows with the .NET 8 SDK; the
Ubuntu-packaged `dotnet-sdk-8.0` used in this session lacks the WindowsDesktop build
targets (those ship with Microsoft's own installer, whose download domains are
blocked by this session's network policy), so nothing here has actually been
compiled. Every change was checked by hand — XML well-formedness, brace/paren
balance, manual trace of bindings and event-handler wiring — but that's not a
substitute for a real build. Build and smoke-test it on a Windows machine before
relying on it.

## Requirements

- Windows 10/11
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [WinGet](https://learn.microsoft.com/windows/package-manager/winget/) (ships with
  modern Windows as "App Installer"; install from the Microsoft Store if missing)

## Build & run

```
cd src/JRAltdIncProgramUpdater
dotnet build
dotnet run
```

`dotnet run` only works here if your terminal itself is already running **as
Administrator** — see the elevation note below for why, and for the alternative if
you'd rather not run your whole terminal elevated.

## Elevation

WinGet upgrades routinely need to write to `Program Files` and `HKLM`, so the app
requests admin rights up front instead of hitting a UAC prompt mid-batch when
updating multiple packages:

- `app.manifest` sets `requestedExecutionLevel level="requireAdministrator"`, so
  Windows elevates the process before it even starts.
- `App.xaml.cs` re-checks elevation on startup (`ElevationHelper.IsElevated()`) as a
  defensive fallback in case the manifest gets stripped by a repackaging/deployment
  step, and relaunches elevated (`ElevationHelper.RelaunchElevated()`) if needed.
- If the user declines the UAC prompt, the app shows a message and closes rather than
  running with reduced permissions.

**Dev-time gotcha:** `dotnet run` launches the built exe via `CreateProcess`, which
cannot trigger a UAC prompt — only `ShellExecute` can (double-clicking in Explorer, or
`Start-Process -Verb RunAs`). Since the manifest requires elevation, `CreateProcess`
just fails outright with Win32 error 740 ("The requested operation requires
elevation") instead of prompting. Two ways around it:

- Run your terminal itself **as Administrator**, then `dotnet run` works normally
  (no further prompt needed — the child process inherits the elevated token).
- Or build once and launch the exe in a way that goes through `ShellExecute`:
  ```
  dotnet build
  Start-Process .\bin\Debug\net8.0-windows\JRAltdIncProgramUpdater.exe -Verb RunAs
  ```
  (or just double-click the exe in File Explorer) — this triggers the UAC prompt as
  expected.

## Distribution

To hand this app to other people (not just run it from source), see
[`packaging/README.md`](packaging/README.md): publish a self-contained exe (no .NET
install required on the recipient's machine), then optionally wrap it in a proper
Inno Setup installer with Start Menu shortcuts and an uninstaller.

## Architecture

```
src/JRAltdIncProgramUpdater/
├── icon.ico                  # app icon (source SVG + regen steps: packaging/icon/)
├── app.manifest              # requireAdministrator + supported OS list
├── App.xaml(.cs)             # startup elevation check, theme resources
├── MainWindow.xaml(.cs)      # update list UI, check/update actions, per-package progress loop
├── Models/
│   ├── UpdatePackage.cs      # Name / Id / Version fields + mutable Status/StatusDetail (INotifyPropertyChanged)
│   └── UpdateStatus.cs       # Pending / InProgress / Succeeded / Failed
├── Converters/
│   └── UpdateStatusConverters.cs  # UpdateStatus -> display text / status-dot brush
├── Services/
│   ├── WinGetService.cs      # shells out to winget, parses `winget upgrade` output
│   ├── ElevationHelper.cs    # admin check + relaunch-as-admin fallback
│   └── AppSettingsService.cs # loads/saves settings.json (ignored ids, auto-check interval)
└── Themes/
    └── JRAltdTheme.xaml      # colors/styles lifted from jraltdinc.us
```

`WinGetService` runs `winget upgrade` and `winget upgrade --id <id>` as child
processes and parses the CLI's fixed-width table output into `UpdatePackage`
records. It doesn't shell through `cmd.exe` or otherwise interpolate untrusted
input into a shell string — arguments are passed directly via `ProcessStartInfo`.

**"Update All" runs packages one at a time**, not via a single `winget upgrade
--all` call — that's what lets each row's Status column track exactly which
package is currently updating vs. done vs. failed. Each package's `StatusDetail`
is fed by winget's own stdout lines as they arrive (shown as a tooltip on the
status cell); this is best-effort — winget doesn't guarantee a stable line format
or a numeric percentage, so treat it as informational text, not a progress bar.

## Skip / ignore packages

Each card has a **Skip** link. Skipping a package adds its WinGet id to a persisted
ignore list and removes it from the list immediately; it stays out of future "Check
for Updates" results (and therefore out of "Update All") until you click **Reset
Skipped** in the footer, which clears the whole ignore list at once. There's
currently no per-item "unskip" — only reset-all — to keep the UI simple; ask if you
want individual restore.

Ignored ids are stored per-user in
`%LOCALAPPDATA%\JRAltdIncProgramUpdater\settings.json`.

## Scheduled checks

The "Auto-check" toggle row (next to the WinGet description text) lets you pick Off /
30m / 1h / 6h / 24h. This drives an in-app `DispatcherTimer` that re-runs "Check for
Updates" on that interval **while the app is open** — it is not a Windows Task
Scheduler entry, so it does nothing while the app isn't running. The selected
interval is persisted in the same `settings.json` and restored on next launch. If you
want checks to happen even when the app is closed (e.g. a scheduled task that
launches the app, checks, and notifies), that's a separate, bigger feature — let me
know if you want it built.

## Style reference

Colors and typography are pulled directly from jraltdinc.us's `:root` CSS variables
(`Themes/JRAltdTheme.xaml`):

| Token | Value | Use |
|---|---|---|
| Background | `#0A0E17` | window background |
| Background (alt) | `#10151F` | card / list background |
| Cyan | `#2FD8EF` | headings, borders, buttons |
| Text | `#E6F1F5` | primary text |
| Muted | `#9DB0BB` | secondary text |
| Button text | `#06131A` | text on cyan buttons |
