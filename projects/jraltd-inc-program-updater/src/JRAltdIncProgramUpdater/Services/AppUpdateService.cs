using System.IO;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace JRAltdIncProgramUpdater.Services;

/// <summary>A newer release found by <see cref="AppUpdateService"/>, ready to download.</summary>
public sealed record AppUpdateInfo(Version Version, string DownloadUrl, string FileName);

/// <summary>
/// Checks GitHub Releases for a newer build of this app itself (distinct from
/// WinGetService, which checks for updates to *other* installed packages). Not
/// Velopack or any other auto-update framework: those assume the app can silently
/// rewrite its own install directory without elevation, which conflicts with this
/// app's requireAdministrator manifest (WinGet upgrades need admin) -- Velopack's
/// own docs say apps requiring admin at runtime aren't supported. This is a plain
/// "check, prompt, download the new installer, run it elevated like normal, then
/// exit" flow instead, so it fits an always-elevated app without changing how or
/// where it's installed.
/// </summary>
public sealed class AppUpdateService
{
    // This repo hosts more than one project, so a release's tag is scoped with this
    // prefix (see packaging instructions this app's own README points at) --
    // matching on it, not just "the latest release for the whole repo", is what
    // keeps this from picking up some other project's release by mistake.
    private const string TagPrefix = "program-updater-v";
    private const string ReleasesApiUrl = "https://api.github.com/repos/JRAltd/JRAltd-Workshop/releases";

    /// <summary>
    /// The release asset to download — the Inno Setup *installer*, matching
    /// OutputBaseFilename in packaging/setup.iss. Matched by exact name rather than
    /// "any .exe asset": a release also plausibly carries the raw published app exe
    /// (JRAltdIncProgramUpdater.exe), and downloading and running *that* would look
    /// like an update while doing nothing but launching a second copy of the app.
    /// A release without this exact asset is skipped entirely rather than falling
    /// back to some other .exe — no update offered beats the wrong one. If
    /// setup.iss's OutputBaseFilename ever changes, change this with it (the site's
    /// download link hardcodes the same name too).
    /// </summary>
    private const string InstallerAssetName = "JRAltdIncProgramUpdaterSetup.exe";

    /// <summary>
    /// Returns the newest published (non-draft, non-prerelease) release newer than
    /// <paramref name="currentVersion"/>, or null if already up to date, the check
    /// failed (no network, GitHub unreachable, rate-limited, etc.), or no release
    /// has a recognizable installer asset. Failures are swallowed rather than
    /// thrown: this is a background nicety, never something that should block or
    /// interrupt the app starting.
    /// </summary>
    public async Task<AppUpdateInfo?> CheckForUpdateAsync(Version currentVersion, CancellationToken ct = default)
    {
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
        // The GitHub REST API rejects requests with no User-Agent header.
        http.DefaultRequestHeaders.UserAgent.ParseAdd("JRAltdIncProgramUpdater");
        http.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");

        List<GitHubRelease>? releases;
        try
        {
            releases = await http.GetFromJsonAsync<List<GitHubRelease>>(ReleasesApiUrl, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or NotSupportedException or System.Text.Json.JsonException or TaskCanceledException)
        {
            return null;
        }

        if (releases is null)
        {
            return null;
        }

        AppUpdateInfo? best = null;
        foreach (var release in releases)
        {
            if (release.Draft || release.Prerelease ||
                !release.TagName.StartsWith(TagPrefix, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (!Version.TryParse(release.TagName[TagPrefix.Length..], out var releaseVersion) ||
                releaseVersion <= currentVersion ||
                (best is not null && releaseVersion <= best.Version))
            {
                continue;
            }

            var asset = release.Assets.FirstOrDefault(a =>
                string.Equals(a.Name, InstallerAssetName, StringComparison.OrdinalIgnoreCase));
            if (asset is null)
            {
                continue;
            }

            best = new AppUpdateInfo(releaseVersion, asset.BrowserDownloadUrl, asset.Name);
        }

        return best;
    }

    /// <summary>
    /// Downloads <paramref name="update"/>'s installer to a temp file and returns
    /// its path. <paramref name="progress"/>, if supplied, receives 0-100 as the
    /// download proceeds (100 if the server doesn't report a content length, since
    /// there's then no way to compute a real percentage).
    /// </summary>
    public async Task<string> DownloadInstallerAsync(AppUpdateInfo update, IProgress<int>? progress = null, CancellationToken ct = default)
    {
        using var http = new HttpClient { Timeout = TimeSpan.FromMinutes(10) };
        http.DefaultRequestHeaders.UserAgent.ParseAdd("JRAltdIncProgramUpdater");

        using var response = await http.GetAsync(update.DownloadUrl, HttpCompletionOption.ResponseHeadersRead, ct);
        response.EnsureSuccessStatusCode();

        var totalBytes = response.Content.Headers.ContentLength;

        // A fresh directory per download, rather than a fixed %TEMP%\<name> path.
        // Writing to a fixed path failed in testing with "the process cannot access
        // the file ... because it is being used by another process": a leftover file
        // from an earlier attempt can still be held open by something else (an
        // antivirus scanning a newly-written 150MB executable is the usual culprit),
        // and FileMode.Create can't reopen a file another process has locked. A path
        // nothing has seen before can't be locked by anything.
        var downloadDirectory = Path.Combine(
            Path.GetTempPath(),
            $"JRAltdIncProgramUpdater-{update.Version}-{Guid.NewGuid():N}");
        Directory.CreateDirectory(downloadDirectory);
        var destinationPath = Path.Combine(downloadDirectory, update.FileName);

        await using var httpStream = await response.Content.ReadAsStreamAsync(ct);
        await using var fileStream = new FileStream(destinationPath, FileMode.Create, FileAccess.Write, FileShare.None);

        var buffer = new byte[81920];
        long totalRead = 0;
        int read;
        while ((read = await httpStream.ReadAsync(buffer, ct)) > 0)
        {
            await fileStream.WriteAsync(buffer.AsMemory(0, read), ct);
            totalRead += read;
            if (totalBytes is > 0)
            {
                progress?.Report((int)(totalRead * 100 / totalBytes.Value));
            }
        }

        progress?.Report(100);
        return destinationPath;
    }

    private sealed class GitHubRelease
    {
        [JsonPropertyName("tag_name")]
        public string TagName { get; set; } = "";

        public bool Draft { get; set; }

        public bool Prerelease { get; set; }

        public List<GitHubReleaseAsset> Assets { get; set; } = new();
    }

    private sealed class GitHubReleaseAsset
    {
        public string Name { get; set; } = "";

        [JsonPropertyName("browser_download_url")]
        public string BrowserDownloadUrl { get; set; } = "";
    }
}
