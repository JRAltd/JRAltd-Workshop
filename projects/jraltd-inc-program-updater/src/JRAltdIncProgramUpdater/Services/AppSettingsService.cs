using System.IO;
using System.Text.Json;

namespace JRAltdIncProgramUpdater.Services;

public sealed class AppSettings
{
    public List<string> IgnoredPackageIds { get; set; } = new();

    /// <summary>0 = auto-check disabled.</summary>
    public int ScheduledCheckIntervalMinutes { get; set; }
}

/// <summary>
/// Persists <see cref="AppSettings"/> as JSON under the current user's LocalAppData.
/// This app runs elevated (requireAdministrator), but UAC elevation of a standard
/// user's own account keeps LocalApplicationData pointed at that same user's
/// profile, not a separate admin profile, so this still round-trips correctly for
/// the normal single-user-elevating-their-own-session case.
/// </summary>
public static class AppSettingsService
{
    private static readonly string SettingsPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "JRAltdIncProgramUpdater",
        "settings.json");

    public static AppSettings Load()
    {
        try
        {
            if (!File.Exists(SettingsPath))
            {
                return new AppSettings();
            }

            var json = File.ReadAllText(SettingsPath);
            return JsonSerializer.Deserialize<AppSettings>(json) ?? new AppSettings();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
        {
            return new AppSettings();
        }
    }

    public static void Save(AppSettings settings)
    {
        var directory = Path.GetDirectoryName(SettingsPath)!;
        Directory.CreateDirectory(directory);
        var json = JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(SettingsPath, json);
    }
}
