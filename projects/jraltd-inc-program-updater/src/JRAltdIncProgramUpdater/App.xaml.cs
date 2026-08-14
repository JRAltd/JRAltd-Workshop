using System.Threading;
using System.Windows;
using JRAltdIncProgramUpdater.Services;

namespace JRAltdIncProgramUpdater;

public partial class App : Application
{
    /// <summary>
    /// Named mutex Inno Setup's AppMutex directive (packaging/setup.iss) checks for
    /// before installing, so a self-triggered update (see
    /// MainWindow.CheckForAppUpdateAsync) can detect and close this still-running
    /// instance first -- without it, launching the new installer while this
    /// process is still alive risks it failing to overwrite this exe's own locked
    /// file. Held via this field for the app's lifetime so it isn't garbage
    /// collected early; Windows releases it automatically on process exit, so it's
    /// never explicitly disposed. The exact string must match AppMutex in
    /// setup.iss.
    /// </summary>
    private Mutex? _appMutex;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        // app.manifest already requests requireAdministrator, so this should always
        // be true. It's re-checked here as a guard against repackaging/deployment
        // tools (e.g. some MSIX or ClickOnce setups) that can strip or ignore the
        // embedded manifest.
        if (ElevationHelper.IsElevated())
        {
            _appMutex = new Mutex(initiallyOwned: false, name: "JRAltdIncProgramUpdaterAppMutex");
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
