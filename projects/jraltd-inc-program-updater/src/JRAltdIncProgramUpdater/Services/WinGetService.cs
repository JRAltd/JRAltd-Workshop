using System.ComponentModel;
using System.Diagnostics;
using System.Text;
using JRAltdIncProgramUpdater.Models;

namespace JRAltdIncProgramUpdater.Services;

/// <summary>
/// Thin wrapper around the `winget` CLI (Windows Package Manager / App Installer).
/// Every call here assumes the host process is already running elevated — enforced by
/// app.manifest — since winget upgrades commonly write to Program Files and HKLM.
/// </summary>
public sealed class WinGetService
{
    private const string WinGetExe = "winget";

    /// <summary>
    /// Ceiling for a single package upgrade. --silent covers most installer UI, but
    /// not every kind of prompt (e.g. some custom license agreements, or a hash-
    /// mismatch confirmation) -- those block waiting for stdin input we never
    /// provide, which would otherwise hang indefinitely with no feedback.
    /// </summary>
    private static readonly TimeSpan UpgradeTimeout = TimeSpan.FromMinutes(10);

    public static bool IsWinGetAvailable()
    {
        try
        {
            using var probe = Process.Start(new ProcessStartInfo
            {
                FileName = WinGetExe,
                Arguments = "--version",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            });
            probe?.WaitForExit(5000);
            return probe is { ExitCode: 0 };
        }
        catch (Win32Exception)
        {
            // winget.exe isn't on PATH (App Installer not installed).
            return false;
        }
    }

    public async Task<IReadOnlyList<UpdatePackage>> GetAvailableUpdatesAsync(CancellationToken ct = default)
    {
        var (_, output) = await RunAsync("upgrade --include-unknown --accept-source-agreements", progress: null, ct);
        return ParsePackageTable(output);
    }

    /// <summary>
    /// Upgrades a single package. <paramref name="progress"/>, if supplied, receives each
    /// line winget writes to stdout/stderr as it arrives (e.g. "Downloading", "Installing"),
    /// so callers can show live per-package status. There's no guaranteed line format or
    /// cadence across winget versions/sources — this is best-effort detail, not a parsed
    /// percentage. <c>Succeeded</c> reflects winget's own exit code only; it does not by
    /// itself confirm the installed version actually changed — pair with
    /// <see cref="GetInstalledVersionAsync"/> to verify. <c>BlockedByWinGet</c> is true when
    /// the failure is winget itself refusing to proceed (currently: an installer hash
    /// mismatch) rather than something a retry or a fresh scan might resolve on its own —
    /// callers can use this to stop offering the package for upgrade instead of surfacing it
    /// as a normal, retryable failure.
    /// </summary>
    public async Task<(bool Succeeded, bool BlockedByWinGet)> UpgradePackageAsync(string packageId, IProgress<string>? progress = null, CancellationToken ct = default)
    {
        // --include-unknown matters here, not just for the list scan: winget's
        // documented default is to skip upgrading a package if it can't determine
        // the currently-installed version, even when targeted directly by --id.
        // Without this, packages that show "Unknown" as their current version (e.g.
        // some driver/vendor tools) silently fail to upgrade.
        var args = $"upgrade --id \"{packageId}\" --exact --include-unknown --silent " +
                   "--accept-source-agreements --accept-package-agreements";

        // Recognized so a hash-mismatch failure gets a plain-language explanation
        // below, instead of just winget's one-line error, and so the caller can treat
        // it as non-retryable. There is deliberately no way to bypass this from here:
        // winget itself refuses to override a failed installer hash check while
        // running elevated, by design -- this app runs elevated for every upgrade
        // (see app.manifest), so this can't be worked around, only explained.
        var sawHashMismatch = false;
        var wrappedProgress = new Progress<string>(line =>
        {
            if (line.Contains("hash does not match", StringComparison.OrdinalIgnoreCase))
            {
                sawHashMismatch = true;
            }

            progress?.Report(line);
        });

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(UpgradeTimeout);

        try
        {
            var (exitCode, _) = await RunAsync(args, wrappedProgress, timeoutCts.Token);
            if (exitCode != 0 && sawHashMismatch)
            {
                progress?.Report(
                    "WinGet's listing for this package has a stale installer hash (the download doesn't match " +
                    "what WinGet expects), and refuses to install it while running elevated -- a WinGet security " +
                    "check, not something this app can override. Update it manually from the publisher instead, " +
                    "or check winget-pkgs on GitHub for a fix to this package's manifest.");
            }

            return (exitCode == 0, sawHashMismatch && exitCode != 0);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            // Our own timeout fired, not an external cancellation -- winget was most
            // likely stuck waiting for input we can't provide.
            progress?.Report($"Timed out after {UpgradeTimeout.TotalMinutes:0} minutes waiting for winget " +
                              "(it may be stuck on a prompt --silent doesn't cover).");
            return (false, false);
        }
    }

    /// <summary>
    /// Looks up a specific package's currently-installed version via `winget list`.
    /// Used to verify an upgrade actually took effect: winget's exit code alone isn't
    /// fully trustworthy (e.g. it can report success for an upgrade that needs a
    /// pending reboot to finish applying, leaving the reported installed version
    /// unchanged in the meantime). Returns null if the package can't be found or its
    /// version can't be parsed from the output.
    /// </summary>
    public async Task<string?> GetInstalledVersionAsync(string packageId, CancellationToken ct = default)
    {
        var (_, output) = await RunAsync($"list --id \"{packageId}\" --exact --accept-source-agreements", progress: null, ct);
        var match = ParsePackageTable(output)
            .FirstOrDefault(p => string.Equals(p.Id, packageId, StringComparison.OrdinalIgnoreCase));
        return string.IsNullOrWhiteSpace(match?.CurrentVersion) ? null : match.CurrentVersion;
    }

    private static async Task<(int ExitCode, string Output)> RunAsync(string arguments, IProgress<string>? progress, CancellationToken ct)
    {
        var psi = new ProcessStartInfo
        {
            FileName = WinGetExe,
            Arguments = arguments,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };

        using var process = new Process { StartInfo = psi };
        var stdout = new StringBuilder();

        process.OutputDataReceived += (_, e) =>
        {
            if (e.Data is null)
            {
                return;
            }

            stdout.AppendLine(e.Data);
            progress?.Report(e.Data);
        };

        // RedirectStandardError alone leaves the pipe unread, which can block the
        // child process once its stderr buffer fills, and silently drops whatever
        // diagnostic text winget wrote there (some errors go to stderr, not stdout).
        // Surfaced via progress (useful for diagnosing a failed upgrade) but kept out
        // of the returned Output so it can't corrupt ParsePackageTable's line-by-line
        // reading of stdout.
        process.ErrorDataReceived += (_, e) =>
        {
            if (e.Data is null)
            {
                return;
            }

            progress?.Report(e.Data);
        };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        try
        {
            await process.WaitForExitAsync(ct);
        }
        catch (OperationCanceledException)
        {
            // Cancelling the wait doesn't kill the child process by itself -- without
            // this it would keep running (or hanging) in the background indefinitely.
            try
            {
                process.Kill(entireProcessTree: true);
            }
            catch
            {
                // Best-effort: the process may have already exited on its own between
                // the cancellation and this point.
            }

            throw;
        }

        return (process.ExitCode, stdout.ToString());
    }

    /// <summary>
    /// Parses the fixed-width table both `winget upgrade` and `winget list` print.
    /// Column boundaries are read from the header row's field start offsets rather
    /// than split on whitespace, since package names and ids routinely contain
    /// spaces themselves. Missing columns (e.g. `list` output for an up-to-date
    /// package has no "Available" column) resolve to an empty field rather than an
    /// error, via the same offset-not-found handling in <c>Field</c>.
    /// </summary>
    private static IReadOnlyList<UpdatePackage> ParsePackageTable(string output)
    {
        var lines = output.Replace("\r\n", "\n").Split('\n');
        var headerIndex = Array.FindIndex(lines, l =>
            l.TrimStart().StartsWith("Name", StringComparison.Ordinal) && l.Contains("Id"));
        if (headerIndex < 0)
        {
            return Array.Empty<UpdatePackage>();
        }

        var header = lines[headerIndex];
        var columnNames = new[] { "Name", "Id", "Version", "Available", "Source" };
        var offsets = columnNames.Select(c => header.IndexOf(c, StringComparison.Ordinal)).ToArray();

        string Field(string line, int index)
        {
            var start = offsets[index];
            if (start < 0 || start >= line.Length)
            {
                return string.Empty;
            }

            var end = index + 1 < offsets.Length ? Math.Min(offsets[index + 1], line.Length) : line.Length;
            return line[start..Math.Max(start, end)].Trim();
        }

        var results = new List<UpdatePackage>();
        for (var i = headerIndex + 2; i < lines.Length; i++) // skip header row + "----" separator
        {
            var line = lines[i];
            if (string.IsNullOrWhiteSpace(line) ||
                line.Contains("upgrades available", StringComparison.OrdinalIgnoreCase) ||
                line.Contains("installed package", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var id = Field(line, 1);
            if (string.IsNullOrWhiteSpace(id))
            {
                continue;
            }

            results.Add(new UpdatePackage
            {
                Name = Field(line, 0),
                Id = id,
                CurrentVersion = Field(line, 2),
                AvailableVersion = Field(line, 3),
                Source = Field(line, 4)
            });
        }

        return results;
    }
}
