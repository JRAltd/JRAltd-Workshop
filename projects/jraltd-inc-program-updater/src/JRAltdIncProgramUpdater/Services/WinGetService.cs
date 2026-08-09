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
        return ParseUpgradeTable(output);
    }

    /// <summary>
    /// Upgrades a single package. <paramref name="progress"/>, if supplied, receives each
    /// line winget writes to stdout as it arrives (e.g. "Downloading", "Installing"), so
    /// callers can show live per-package status. There's no guaranteed line format or
    /// cadence across winget versions/sources — this is best-effort detail, not a parsed
    /// percentage.
    /// </summary>
    public async Task<bool> UpgradePackageAsync(string packageId, IProgress<string>? progress = null, CancellationToken ct = default)
    {
        // --include-unknown matters here, not just for the list scan: winget's
        // documented default is to skip upgrading a package if it can't determine
        // the currently-installed version, even when targeted directly by --id.
        // Without this, packages that show "Unknown" as their current version (e.g.
        // some driver/vendor tools) silently fail to upgrade.
        var args = $"upgrade --id \"{packageId}\" --exact --include-unknown --silent " +
                   "--accept-source-agreements --accept-package-agreements";
        var (exitCode, _) = await RunAsync(args, progress, ct);
        return exitCode == 0;
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
        // of the returned Output so it can't corrupt ParseUpgradeTable's line-by-line
        // reading of the list command's stdout.
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
        await process.WaitForExitAsync(ct);
        return (process.ExitCode, stdout.ToString());
    }

    /// <summary>
    /// winget prints a fixed-width table. Column boundaries are read from the header
    /// row's field start offsets rather than split on whitespace, since package names
    /// and ids routinely contain spaces themselves.
    /// </summary>
    private static IReadOnlyList<UpdatePackage> ParseUpgradeTable(string output)
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
                line.Contains("upgrades available", StringComparison.OrdinalIgnoreCase))
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
