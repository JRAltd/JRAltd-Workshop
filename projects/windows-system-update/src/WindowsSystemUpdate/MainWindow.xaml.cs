using System.Collections.ObjectModel;
using System.Windows;
using WindowsSystemUpdate.Models;
using WindowsSystemUpdate.Services;

namespace WindowsSystemUpdate;

public partial class MainWindow : Window
{
    private readonly WinGetService _winget = new();
    private readonly ObservableCollection<UpdatePackage> _updates = new();

    public MainWindow()
    {
        InitializeComponent();
        UpdatesList.ItemsSource = _updates;

        // By the time this window exists, App.OnStartup has already enforced
        // elevation (or shut the app down), so this is purely informational.
        ElevationBadge.Text = ElevationHelper.IsElevated() ? "Running elevated" : "Not elevated";

        _ = InitializeAsync();
    }

    private async Task InitializeAsync()
    {
        if (!WinGetService.IsWinGetAvailable())
        {
            StatusText.Text = "WinGet was not found. Install \"App Installer\" from the Microsoft Store.";
            return;
        }

        await RefreshUpdatesAsync();
    }

    private async void CheckForUpdates_Click(object sender, RoutedEventArgs e) => await RefreshUpdatesAsync();

    private async Task RefreshUpdatesAsync()
    {
        StatusText.Text = "Checking for updates...";
        _updates.Clear();

        try
        {
            var results = await _winget.GetAvailableUpdatesAsync();
            foreach (var pkg in results)
            {
                _updates.Add(pkg);
            }

            StatusText.Text = _updates.Count == 0
                ? "Everything is up to date."
                : $"{_updates.Count} update(s) available.";
        }
        catch (Exception ex)
        {
            StatusText.Text = $"Failed to check for updates: {ex.Message}";
        }
    }

    private async void UpdateSelected_Click(object sender, RoutedEventArgs e)
    {
        var selected = UpdatesList.SelectedItems.Cast<UpdatePackage>().ToList();
        if (selected.Count == 0)
        {
            StatusText.Text = "Select one or more packages first.";
            return;
        }

        await UpdatePackagesAsync(selected);
        await RefreshUpdatesAsync();
    }

    private async void UpdateAll_Click(object sender, RoutedEventArgs e)
    {
        if (_updates.Count == 0)
        {
            StatusText.Text = "Nothing to update.";
            return;
        }

        await UpdatePackagesAsync(_updates.ToList());
        await RefreshUpdatesAsync();
    }

    /// <summary>
    /// Updates packages one at a time (rather than a single `winget upgrade --all`
    /// call) so each row's Status/StatusDetail can reflect exactly which package is
    /// currently running, succeeded, or failed.
    /// </summary>
    private async Task UpdatePackagesAsync(IReadOnlyList<UpdatePackage> targets)
    {
        SetButtonsEnabled(false);
        try
        {
            for (var i = 0; i < targets.Count; i++)
            {
                var pkg = targets[i];
                pkg.Status = UpdateStatus.InProgress;
                pkg.StatusDetail = "Starting...";
                StatusText.Text = $"Updating {i + 1} of {targets.Count}: {pkg.Name}";

                var progress = new Progress<string>(line => pkg.StatusDetail = line);
                var succeeded = await _winget.UpgradePackageAsync(pkg.Id, progress);

                pkg.Status = succeeded ? UpdateStatus.Succeeded : UpdateStatus.Failed;
                pkg.StatusDetail = succeeded ? "Updated" : "Update failed";
            }

            var succeededCount = targets.Count(t => t.Status == UpdateStatus.Succeeded);
            StatusText.Text = $"Finished: {succeededCount}/{targets.Count} package(s) updated.";
        }
        finally
        {
            SetButtonsEnabled(true);
        }
    }

    private void SetButtonsEnabled(bool enabled)
    {
        CheckForUpdatesButton.IsEnabled = enabled;
        UpdateSelectedButton.IsEnabled = enabled;
        UpdateAllButton.IsEnabled = enabled;
    }

    // WindowStyle="None" removes the OS-drawn title bar buttons, so the custom title
    // bar's minimize/close buttons need to drive the window directly.
    private void Minimize_Click(object sender, RoutedEventArgs e) => WindowState = WindowState.Minimized;

    private void Close_Click(object sender, RoutedEventArgs e) => Close();
}
