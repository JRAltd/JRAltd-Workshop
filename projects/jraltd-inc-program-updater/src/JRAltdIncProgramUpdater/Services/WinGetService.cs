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
    /// Known winget failures that a retry or a fresh "Check for Updates" scan won't
    /// fix on their own -- winget itself is refusing to proceed, for reasons outside
    /// this app's control. Matched (in order, first hit wins) against every
    /// stdout/stderr line winget writes; the paired explanation is what callers show
    /// instead of winget's raw one-liner. Extend this list as new non-retryable
    /// patterns turn up in the wild rather than treating them as ordinary failures.
    /// </summary>
    private static readonly (string Pattern, string Explanation)[] NonRetryablePatterns =
    {
        ("hash does not match",
            "WinGet's listing for this package has a stale installer hash (the download doesn't match what " +
            "WinGet expects), and refuses to install it while running elevated -- a WinGet security check, " +
            "not something this app can override. Update it manually from the publisher instead, or check " +
            "winget-pkgs on GitHub for a fix to this package's manifest."),
        ("install technology is different",
            "WinGet found a newer version, but it uses a different installer technology than what's currently " +
            "installed (e.g. switched from an EXE installer to MSI, or vice versa), so it can't upgrade in " +
            "place. Uninstall the current version first, then install the new one -- via WinGet " +
            "(winget install) or the publisher directly."),
    };

    /// <summary>
    /// Upgrades a single package. <paramref name="progress"/>, if supplied, receives each
    /// line winget writes to stdout/stderr as it arrives (e.g. "Downloading", "Installing"),
    /// so callers can show live per-package status. There's no guaranteed line format or
    /// cadence across winget versions/sources — this is best-effort detail, not a parsed
    /// percentage. <c>Succeeded</c> reflects winget's own exit code — callers trust this
    /// directly rather than independently re-verifying the installed version afterward (an
    /// earlier version of this app did that via a `winget list` re-check, but real testing
    /// found every "can't confirm" case was a genuine success winget just hadn't finished
    /// registering yet, sometimes over a minute later — see MainWindow.UpdatePackagesAsync
    /// for the full account). <c>BlockedByWinGet</c> is true when the failure matches a
    /// <see cref="NonRetryablePatterns"/> entry — winget itself refusing to proceed, rather
    /// than something a retry or a fresh scan might resolve on its own — callers can use
    /// this to stop offering the package for upgrade instead of surfacing it as a normal,
    /// retryable failure.
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

        // There is deliberately no attempt to work around any of these once matched:
        // each is winget itself refusing to proceed, by design, not a transient
        // failure this app could retry past.
        string? matchedExplanation = null;
        var wrappedProgress = new Progress<string>(line =>
        {
            if (matchedExplanation is null)
            {
                foreach (var (pattern, explanation) in NonRetryablePatterns)
                {
                    if (line.Contains(pattern, StringComparison.OrdinalIgnoreCase))
                    {
                        matchedExplanation = explanation;
                        break;
                    }
                }
            }

            progress?.Report(line);
        });

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(UpgradeTimeout);

        try
        {
            var (exitCode, _) = await RunAsync(args, wrappedProgress, timeoutCts.Token);
            if (exitCode != 0 && matchedExplanation is not null)
            {
                progress?.Report(matchedExplanation);
            }

            return (exitCode == 0, exitCode != 0 && matchedExplanation is not null);
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
