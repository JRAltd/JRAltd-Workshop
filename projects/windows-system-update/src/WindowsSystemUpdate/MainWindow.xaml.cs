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

        StatusText.Text = $"Updating {selected.Count} package(s)...";
        foreach (var pkg in selected)
        {
            await _winget.UpgradePackageAsync(pkg.Id);
        }

        await RefreshUpdatesAsync();
    }

    private async void UpdateAll_Click(object sender, RoutedEventArgs e)
    {
        StatusText.Text = "Updating all packages...";
        await _winget.UpgradeAllAsync();
        await RefreshUpdatesAsync();
    }
}
