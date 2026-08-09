using System.Windows;
using JRAltdIncProgramUpdater.Services;

namespace JRAltdIncProgramUpdater;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        // app.manifest already requests requireAdministrator, so this should always
        // be true. It's re-checked here as a guard against repackaging/deployment
        // tools (e.g. some MSIX or ClickOnce setups) that can strip or ignore the
        // embedded manifest.
        if (ElevationHelper.IsElevated())
        {
            return;
        }

        if (ElevationHelper.RelaunchElevated())
        {
            Shutdown();
            return;
        }

        MessageBox.Show(
            "JRAltd Inc Program Updater needs administrator privileges to run WinGet upgrades. The app will now close.",
            "Elevation required",
            MessageBoxButton.OK,
            MessageBoxImage.Warning);
        Shutdown();
    }
}
