using System.ComponentModel;
using System.Diagnostics;
using System.Security.Principal;

namespace WindowsSystemUpdate.Services;

/// <summary>
/// Runtime elevation checks and the relaunch-as-admin fallback. app.manifest already
/// forces UAC elevation at launch via requireAdministrator, so under normal operation
/// <see cref="IsElevated"/> is just a defensive confirmation; <see cref="RelaunchElevated"/>
/// only runs if that manifest was somehow ignored.
/// </summary>
public static class ElevationHelper
{
    public static bool IsElevated()
    {
        using var identity = WindowsIdentity.GetCurrent();
        var principal = new WindowsPrincipal(identity);
        return principal.IsInRole(WindowsBuiltInRole.Administrator);
    }

    /// <summary>
    /// Relaunches the current executable with a UAC "runas" prompt. Returns false if
    /// the user declines the prompt (or the executable path can't be resolved), in
    /// which case the caller should not assume an elevated instance is starting.
    /// </summary>
    public static bool RelaunchElevated()
    {
        var exePath = Process.GetCurrentProcess().MainModule?.FileName;
        if (string.IsNullOrEmpty(exePath))
        {
            return false;
        }

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = exePath,
                UseShellExecute = true,
                Verb = "runas"
            });
            return true;
        }
        catch (Win32Exception)
        {
            // ERROR_CANCELLED (1223): the user clicked "No" on the UAC prompt.
            return false;
        }
    }
}
