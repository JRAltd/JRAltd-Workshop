# JRAltd Inc Program Updater

A Windows desktop app that checks for and applies system/package updates via
[WinGet](https://learn.microsoft.com/windows/package-manager/winget/) (the Windows
Package Manager). Styled to match [jraltdinc.us](https://jraltdinc.us/) — dark navy
background, cyan accents, card-style layout, Segoe UI.

## Status

WinGet integration, elevation handling, a styled UI, per-package skip/ignore, a
Blocked section for packages WinGet itself refuses to install, and scheduled
auto-checks are implemented and have been built and exercised on a real Windows
machine (this is developed from a Linux session, which can't build or run a WPF app
at all — see below — so all verification against real WinGet output has happened on
the user's machine across multiple rounds of testing/fixes, not in this repo).

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
│   ├── UpdateStatus.cs       # Pending / InProgress / Succeeded / Failed
│   └── BlockedPackage.cs     # Id / Name / Reason snapshot for a WinGet-refused package
├── Converters/
│   └── UpdateStatusConverters.cs  # UpdateStatus -> display text / status-dot brush
├── Services/
│   ├── WinGetService.cs      # shells out to winget, parses `winget upgrade` output
│   ├── AppUpdateService.cs   # checks GitHub Releases for a newer build of this app itself
│   ├── ElevationHelper.cs    # admin check + relaunch-as-admin fallback
│   ├── AppSettingsService.cs # loads/saves settings.json (ignored ids, blocked packages, auto-check interval)
│   └── RelayCommand.cs       # minimal ICommand, for the per-card Skip/Unblock buttons' Command binding
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
is fed by winget's own stdout/stderr lines as they arrive (shown as a tooltip on
the status cell); this is best-effort — winget doesn't guarantee a stable line
format or a numeric percentage, so treat it as informational text, not a progress
bar.

**A successful exit is trusted, deliberately, after this went back and forth.**
An earlier version re-verified success via `winget list --id <id> --exact`,
comparing the installed version against the package's previous version before
marking it Succeeded — on the theory that winget's exit code alone might not be
fully reliable. In practice, across several real packages (a plain hash-mismatch
failure aside, which is caught separately — see below), every single "winget said
success but the version check couldn't confirm it" case turned out to be a real
success that just hadn't finished registering with Windows yet, sometimes over a
minute later for a large installer like Visual Studio Build Tools. No reasonable
per-package retry window closed that gap reliably, and the repeated false
"Failed" reports did more harm than the (never actually observed) silent-no-op
case the check was meant to catch. So `UpdatePackagesAsync` now trusts a
successful exit directly and removes the package from the visible list
immediately, the same as it already did for a package with an untrackable
("Unknown") version.

A single upgrade is capped at a 10-minute timeout (and the winget process
force-killed if it's hit) in case winget is stuck on a prompt `--silent` doesn't
cover — that part is unrelated to the verification question above and still
applies.

## Self-update

Separate from WinGet entirely: on startup, `AppUpdateService` checks GitHub
Releases for a newer build of this app itself. If one's found, it prompts to
download and run the new installer (which closes this app and relaunches the
installer elevated, same as running it manually).

This is a plain custom check, not a framework like Velopack or Squirrel —
deliberately. Those assume the app can silently rewrite its own install directory
without elevation, which conflicts with this app's `requireAdministrator` manifest
(WinGet upgrades need admin); Velopack's own docs say apps requiring admin at
runtime aren't supported. Since this app is always elevated anyway, an extra "yes,
update now?" prompt isn't a real UX regression, so a from-scratch check is simpler
and avoids restructuring how or where the app is installed.

A few things worth knowing:

- **Three places must be bumped together for every release**, or the check either
  won't fire or will loop offering an "update" to the version already running: the
  `<Version>` in `JRAltdIncProgramUpdater.csproj`, `MyAppVersion` in
  `packaging/setup.iss`, and the git tag used for the GitHub release
  (`program-updater-vX.Y.Z`).
- The check matches releases by that `program-updater-v` tag prefix specifically,
  not just "the latest release for the whole repo" — this repo hosts more than one
  project, so trusting `/releases/latest` blindly could pick up some other
  project's release.
- Launching the new installer while this app is still running risks Windows
  refusing to let it overwrite this process's own locked `.exe`. `App.xaml.cs`
  creates a named Mutex (`JRAltdIncProgramUpdaterAppMutex`) while running, and
  `setup.iss` sets `AppMutex` to the same string — that's what lets Setup detect
  and close the running instance before installing. If you ever rename that mutex
  in one file, rename it in the other too.
- Network failures, GitHub being unreachable, or rate-limiting are swallowed
  silently — this check should never block or interrupt the app's actual purpose.

## Skip / ignore packages

Each card has a **Skip** link. Skipping a package adds its WinGet id to a persisted
ignore list and removes it from the list immediately; it stays out of future "Check
for Updates" results (and therefore out of "Update All") until you click **Reset
Skipped** in the footer, which clears the whole ignore list at once. There's
currently no per-item "unskip" — only reset-all — to keep the UI simple; ask if you
want individual restore.

Ignored ids are stored per-user in
`%LOCALAPPDATA%\JRAltdIncProgramUpdater\settings.json`.

## Blocked packages

Separate from Skip: if an upgrade fails because **WinGet itself** refuses to
proceed — currently detected via winget's "installer hash does not match" error, a
security check that can't be overridden while running elevated, and isn't fixed by
retrying or by a fresh scan (see `WinGetService.UpgradePackageAsync`'s
`BlockedByWinGet` result) — the package is moved into a **Blocked** section instead
of being left to fail the same way on every future check. Switch between **Updates**
and **Blocked** via the segmented toggle next to the "Updates" heading.

Each blocked card shows the actual reason (selectable/copyable, same as a failed
update's detail text) and an **Unblock** button — unlike Skip, Blocked supports
per-item removal, since these usually resolve upstream (a `winget-pkgs` manifest fix)
rather than needing a manual "try it again sometime." Unblocking doesn't
re-add the package to Updates directly (only an Id/Name/Reason snapshot is kept, not
current version info) — click **Check for Updates** afterward to see it again.
**Unblock All** clears the whole list at once. Blocked packages are stored per-user
alongside the ignore list, in the same `settings.json`.

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
