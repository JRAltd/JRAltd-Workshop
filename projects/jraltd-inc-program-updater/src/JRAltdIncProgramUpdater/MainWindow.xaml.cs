using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Controls.Primitives;
using System.Windows.Threading;
using JRAltdIncProgramUpdater.Models;
using JRAltdIncProgramUpdater.Services;

namespace JRAltdIncProgramUpdater;

public partial class MainWindow : Window
{
    private readonly WinGetService _winget = new();
    private readonly ObservableCollection<UpdatePackage> _updates = new();
    private readonly AppSettings _settings;
    private readonly HashSet<string> _ignoredIds;
    private readonly DispatcherTimer _autoCheckTimer = new();

    /// <summary>Full result set from the last WinGet check, before the ignored-packages filter.</summary>
    private List<UpdatePackage> _allResults = new();

    /// <summary>Guards against the auto-check timer firing while a check or update run is already in flight.</summary>
    private bool _isBusy;

    public MainWindow()
    {
        InitializeComponent();
        UpdatesList.ItemsSource = _updates;

        _settings = AppSettingsService.Load();
        _ignoredIds = new HashSet<string>(_settings.IgnoredPackageIds, StringComparer.OrdinalIgnoreCase);

        // By the time this window exists, App.OnStartup has already enforced
        // elevation (or shut the app down), so this is purely informational.
        ElevationBadge.Text = ElevationHelper.IsElevated() ? "Running elevated" : "Not elevated";

        _autoCheckTimer.Tick += async (_, _) => await AutoCheckTick();
        RestoreAutoCheckInterval();

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

    private async Task AutoCheckTick()
    {
        if (_isBusy)
        {
            return;
        }

        await RefreshUpdatesAsync();
    }

    private async Task RefreshUpdatesAsync()
    {
        if (_isBusy)
        {
            return;
        }

        _isBusy = true;
        CheckForUpdatesButton.IsEnabled = false;
        StatusText.Text = "Checking for updates...";
        _updates.Clear();

        try
        {
            _allResults = (await _winget.GetAvailableUpdatesAsync()).ToList();
            ApplyIgnoredFilter();
        }
        catch (Exception ex)
        {
            StatusText.Text = $"Failed to check for updates: {ex.Message}";
        }
        finally
        {
            _isBusy = false;
            CheckForUpdatesButton.IsEnabled = true;
        }
    }

    /// <summary>Repopulates the visible list from <see cref="_allResults"/>, excluding ignored package ids.</summary>
    private void ApplyIgnoredFilter()
    {
        _updates.Clear();
        foreach (var pkg in _allResults.Where(p => !_ignoredIds.Contains(p.Id)))
        {
            _updates.Add(pkg);
        }

        var baseText = _updates.Count == 0
            ? "Everything is up to date."
            : $"{_updates.Count} update(s) available.";
        StatusText.Text = _ignoredIds.Count > 0 ? $"{baseText} ({_ignoredIds.Count} skipped)" : baseText;
    }

    /// <summary>
    /// Handles the Button.Click routed event bubbled up from the per-card "Skip"
    /// button (see UpdatesList's Button.Click="SkipPackage_Click" in this file, and
    /// the comment on that button in JRAltdTheme.xaml's UpdateCardTemplate for why
    /// it's wired here rather than on the button itself). Because this is a bubbled
    /// event, `sender` is the ListBox the handler is attached to, not the button that
    /// was clicked; e.Source is the actual button, whose DataContext is the bound
    /// UpdatePackage.
    /// </summary>
    private void SkipPackage_Click(object sender, RoutedEventArgs e)
    {
        if (e.Source is not FrameworkElement { DataContext: UpdatePackage pkg })
        {
            return;
        }

        _ignoredIds.Add(pkg.Id);
        PersistIgnoredIds();
        ApplyIgnoredFilter();
    }

    private void ResetSkipped_Click(object sender, RoutedEventArgs e)
    {
        if (_ignoredIds.Count == 0)
        {
            StatusText.Text = "No packages are currently skipped.";
            return;
        }

        _ignoredIds.Clear();
        PersistIgnoredIds();
        ApplyIgnoredFilter();
    }

    private void PersistIgnoredIds()
    {
        _settings.IgnoredPackageIds = _ignoredIds.ToList();
        AppSettingsService.Save(_settings);
    }

    private IEnumerable<ToggleButton> AutoCheckToggles =>
        new[] { AutoCheckOffToggle, AutoCheck30Toggle, AutoCheck1hToggle, AutoCheck6hToggle, AutoCheck24hToggle };

    private void RestoreAutoCheckInterval()
    {
        var savedMinutes = _settings.ScheduledCheckIntervalMinutes;
        foreach (var toggle in AutoCheckToggles)
        {
            toggle.IsChecked = toggle.Tag is string tag && int.TryParse(tag, out var minutes) && minutes == savedMinutes;
        }

        ConfigureAutoCheckTimer(savedMinutes);
    }

    private void AutoCheckInterval_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not ToggleButton clicked || clicked.Tag is not string tag || !int.TryParse(tag, out var minutes))
        {
            return;
        }

        foreach (var toggle in AutoCheckToggles)
        {
            toggle.IsChecked = ReferenceEquals(toggle, clicked);
        }

        _settings.ScheduledCheckIntervalMinutes = minutes;
        AppSettingsService.Save(_settings);
        ConfigureAutoCheckTimer(minutes);
    }

    private void ConfigureAutoCheckTimer(int minutes)
    {
        _autoCheckTimer.Stop();
        if (minutes <= 0)
        {
            return;
        }

        _autoCheckTimer.Interval = TimeSpan.FromMinutes(minutes);
        _autoCheckTimer.Start();
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
        _isBusy = true;
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
            _isBusy = false;
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
