# Windows System Update Application

A Windows desktop app that checks for and applies system/package updates via
[WinGet](https://learn.microsoft.com/windows/package-manager/winget/) (the Windows
Package Manager). Styled to match [jraltdinc.us](https://jraltdinc.us/) — dark navy
background, cyan accents, card-style layout, Segoe UI.

## Status

Functional first version: WinGet integration, elevation handling, and a styled UI are
implemented. **Not build-verified** — this was written in a Linux dev session, and WPF
apps only build/run on Windows with the .NET 8 SDK. Build and smoke-test it on a
Windows machine before relying on it.

## Requirements

- Windows 10/11
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [WinGet](https://learn.microsoft.com/windows/package-manager/winget/) (ships with
  modern Windows as "App Installer"; install from the Microsoft Store if missing)

## Build & run

```
cd src/WindowsSystemUpdate
dotnet build
dotnet run
```

Windows will prompt for administrator elevation on launch (see below) — accept it for
the app to work.

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

## Architecture

```
src/WindowsSystemUpdate/
├── app.manifest              # requireAdministrator + supported OS list
├── App.xaml(.cs)             # startup elevation check, theme resources
├── MainWindow.xaml(.cs)      # update list UI, check/update actions
├── Models/
│   └── UpdatePackage.cs      # Name / Id / CurrentVersion / AvailableVersion / Source
├── Services/
│   ├── WinGetService.cs      # shells out to winget, parses `winget upgrade` output
│   └── ElevationHelper.cs    # admin check + relaunch-as-admin fallback
└── Themes/
    └── JRAltdTheme.xaml      # colors/styles lifted from jraltdinc.us
```

`WinGetService` runs `winget upgrade`, `winget upgrade --id <id>`, and
`winget upgrade --all` as child processes and parses the CLI's fixed-width table
output into `UpdatePackage` records. It doesn't shell through `cmd.exe` or otherwise
interpolate untrusted input into a shell string — arguments are passed directly via
`ProcessStartInfo`.

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
