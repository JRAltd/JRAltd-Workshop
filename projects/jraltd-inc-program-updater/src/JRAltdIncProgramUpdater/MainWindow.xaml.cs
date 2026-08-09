using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Threading;
using JRAltdIncProgramUpdater.Models;
using JRAltdIncProgramUpdater.Services;

namespace JRAltdIncProgramUpdater;

public partial class MainWindow : Window
{
    private readonly WinGetService _winget = new();
    private readonly ObservableCollection<UpdatePackage> _updates = new();
    private readonly ObservableCollection<BlockedPackage> _blocked = new();
    private readonly AppSettings _settings;
    private readonly HashSet<string> _ignoredIds;
    private readonly DispatcherTimer _autoCheckTimer = new();

    /// <summary>Full result set from the last WinGet check, before the ignored/blocked filters.</summary>
    private List<UpdatePackage> _allResults = new();

    /// <summary>Guards against the auto-check timer firing while a check or update run is already in flight.</summary>
    private bool _isBusy;

    /// <summary>
    /// Bound to each card's Skip button (CommandParameter="{Binding}" passes the
    /// card's UpdatePackage). Command binding, not a routed Click event, because the
    /// button lives inside a DataTemplate defined in JRAltdTheme.xaml -- a
    /// ResourceDictionary with no code-behind class -- and Command/CommandParameter
    /// binding is a data-binding mechanism independent of that, unlike XAML
    /// event-attribute resolution or routed-event bubbling.
    /// </summary>
    public ICommand SkipCommand { get; }

    /// <summary>Bound to each Blocked-card's Unblock button; same reasoning as <see cref="SkipCommand"/>.</summary>
    public ICommand UnblockCommand { get; }

    public MainWindow()
    {
        InitializeComponent();
        UpdatesList.ItemsSource = _updates;
        BlockedList.ItemsSource = _blocked;

        _settings = AppSettingsService.Load();
        _ignoredIds = new HashSet<string>(_settings.IgnoredPackageIds, StringComparer.OrdinalIgnoreCase);
        foreach (var blocked in _settings.BlockedPackages)
        {
            _blocked.Add(blocked);
        }

        SkipCommand = new RelayCommand(SkipPackage);
        UnblockCommand = new RelayCommand(UnblockPackage);

        // By the time this window exists, App.OnStartup has already enforced
        // elevation (or shut the app down), so this is purely informational.
        ElevationBadge.Text = ElevationHelper.IsElevated() ? "Running elevated" : "Not elevated";

        _autoCheckTimer.Tick += async (_, _) => await AutoCheckTick();
        RestoreAutoCheckInterval();
        UpdateSectionToggleLabels();

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
            ApplyFilters();
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

    /// <summary>
    /// Repopulates the visible Updates list from <see cref="_allResults"/>, excluding
    /// both skipped (<see cref="_ignoredIds"/>) and blocked (<see cref="_blocked"/>)
    /// package ids -- a package winget refuses to install stays out of the main list
    /// even after a fresh scan re-discovers it, until explicitly unblocked.
    /// </summary>
    private void ApplyFilters()
    {
        var blockedIds = new HashSet<string>(_blocked.Select(b => b.Id), StringComparer.OrdinalIgnoreCase);

        _updates.Clear();
        foreach (var pkg in _allResults.Where(p => !_ignoredIds.Contains(p.Id) && !blockedIds.Contains(p.Id)))
        {
            _updates.Add(pkg);
        }

        var baseText = _updates.Count == 0
            ? "Everything is up to date."
            : $"{_updates.Count} update(s) available.";
        var suffixParts = new List<string>();
        if (_ignoredIds.Count > 0)
        {
            suffixParts.Add($"{_ignoredIds.Count} skipped");
        }

        if (_blocked.Count > 0)
        {
            suffixParts.Add($"{_blocked.Count} blocked");
        }

        StatusText.Text = suffixParts.Count > 0 ? $"{baseText} ({string.Join(", ", suffixParts)})" : baseText;
        UpdateSectionToggleLabels();
    }

    private void SkipPackage(object? parameter)
    {
        if (parameter is not UpdatePackage pkg)
        {
            return;
        }

        _ignoredIds.Add(pkg.Id);
        PersistIgnoredIds();
        ApplyFilters();
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
        ApplyFilters();
    }

    private void PersistIgnoredIds()
    {
        _settings.IgnoredPackageIds = _ignoredIds.ToList();
        AppSettingsService.Save(_settings);
    }

    /// <summary>
    /// Moves a package out of the Updates list into Blocked, persisted, because
    /// winget itself refuses to install it (currently: a stale installer hash) --
    /// not something a retry or a fresh scan will fix, so it shouldn't keep coming
    /// back into the main list on every "Check for Updates".
    /// </summary>
    private void BlockPackage(UpdatePackage pkg, string reason)
    {
        if (_blocked.Any(b => string.Equals(b.Id, pkg.Id, StringComparison.OrdinalIgnoreCase)))
        {
            return;
        }

        _blocked.Add(new BlockedPackage { Id = pkg.Id, Name = pkg.Name, Reason = reason });
        PersistBlockedPackages();
        _updates.Remove(pkg);
        _allResults.RemoveAll(p => string.Equals(p.Id, pkg.Id, StringComparison.OrdinalIgnoreCase));
        UpdateSectionToggleLabels();
    }

    private void UnblockPackage(object? parameter)
    {
        if (parameter is not BlockedPackage blocked)
        {
            return;
        }

        _blocked.Remove(blocked);
        PersistBlockedPackages();
        UpdateSectionToggleLabels();
        // Not re-added to _updates directly: this app only holds a Name/Id/Reason
        // snapshot for a blocked package, not current version info, so there's
        // nothing valid to show as a card until a real scan re-discovers it.
        StatusText.Text = $"{blocked.Name} unblocked. Click \"Check for Updates\" to see it again.";
    }

    private void UnblockAll_Click(object sender, RoutedEventArgs e)
    {
        if (_blocked.Count == 0)
        {
            StatusText.Text = "No packages are currently blocked.";
            return;
        }

        _blocked.Clear();
        PersistBlockedPackages();
        UpdateSectionToggleLabels();
        StatusText.Text = "All packages unblocked. Click \"Check for Updates\" to see them again.";
    }

    private void PersistBlockedPackages()
    {
        _settings.BlockedPackages = _blocked.ToList();
        AppSettingsService.Save(_settings);
    }

    /// <summary>Switches between the Updates and Blocked lists (and their section-specific footer buttons).</summary>
    private void SectionToggle_Click(object sender, RoutedEventArgs e)
    {
        var showBlocked = ReferenceEquals(sender, BlockedSectionToggle);
        UpdatesSectionToggle.IsChecked = !showBlocked;
        BlockedSectionToggle.IsChecked = showBlocked;

        UpdatesList.Visibility = showBlocked ? Visibility.Collapsed : Visibility.Visible;
        BlockedList.Visibility = showBlocked ? Visibility.Visible : Visibility.Collapsed;

        ResetSkippedButton.Visibility = showBlocked ? Visibility.Collapsed : Visibility.Visible;
        UpdateSelectedButton.Visibility = showBlocked ? Visibility.Collapsed : Visibility.Visible;
        UpdateAllButton.Visibility = showBlocked ? Visibility.Collapsed : Visibility.Visible;
        UnblockAllButton.Visibility = showBlocked ? Visibility.Visible : Visibility.Collapsed;
    }

    private void UpdateSectionToggleLabels()
    {
        UpdatesSectionToggle.Content = $"Updates ({_updates.Count})";
        BlockedSectionToggle.Content = $"Blocked ({_blocked.Count})";
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
    }

    private async void UpdateAll_Click(object sender, RoutedEventArgs e)
    {
        if (_updates.Count == 0)
        {
            StatusText.Text = "Nothing to update.";
            return;
        }

        await UpdatePackagesAsync(_updates.ToList());
    }

    /// <summary>
    /// Updates packages one at a time (rather than a single `winget upgrade --all`
    /// call) so each row's Status/StatusDetail can reflect exactly which package is
    /// currently running, succeeded, or failed. winget's own exit code isn't fully
    /// trustworthy on its own (it can report success without the installed version
    /// actually changing), so a successful exit is followed by a version check via
    /// GetInstalledVersionAsync; only a package that's verifiably updated is removed
    /// from the visible list, immediately rather than waiting for the whole batch.
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
                var (reportedSuccess, blockedByWinGet) = await _winget.UpgradePackageAsync(pkg.Id, progress);

                if (!reportedSuccess)
                {
                    pkg.Status = UpdateStatus.Failed;
                    if (string.IsNullOrWhiteSpace(pkg.StatusDetail))
                    {
                        // No output at all from winget -- fall back to a generic message.
                        // Otherwise keep whatever winget's last stdout/stderr line was:
                        // that's the actual reason it failed (e.g. "No installed package
                        // found matching input criteria") -- hover the status pill to see it.
                        pkg.StatusDetail = "Update failed (no output from winget)";
                    }

                    if (blockedByWinGet)
                    {
                        // Not a retryable failure -- winget itself refuses this package
                        // (e.g. a stale installer hash), so move it out of the Updates
                        // list entirely instead of leaving it to fail the same way again
                        // on the next "Check for Updates".
                        BlockPackage(pkg, pkg.StatusDetail);
                    }

                    continue;
                }

                StatusText.Text = $"Verifying {pkg.Name}...";

                // A package winget could never read a version for in the first place
                // (shown as "Unknown" in the original scan) can't be proven to have
                // changed by comparing version strings -- there's nothing to compare
                // against, so fall back to trusting winget's own reported success
                // rather than permanently failing something that likely did work.
                if (string.IsNullOrWhiteSpace(pkg.CurrentVersion) ||
                    string.Equals(pkg.CurrentVersion, "Unknown", StringComparison.OrdinalIgnoreCase))
                {
                    pkg.Status = UpdateStatus.Succeeded;
                    pkg.StatusDetail = "Updated (installed version could not be tracked before or after, so this is based on winget's reported result)";
                    _updates.Remove(pkg);
                    _allResults.RemoveAll(p => string.Equals(p.Id, pkg.Id, StringComparison.OrdinalIgnoreCase));
                    continue;
                }

                var installedVersion = await GetInstalledVersionWithRetryAsync(pkg.Id, pkg.CurrentVersion);
                var verified = !string.IsNullOrWhiteSpace(installedVersion) &&
                                !string.Equals(installedVersion, pkg.CurrentVersion, StringComparison.OrdinalIgnoreCase);

                if (verified)
                {
                    pkg.Status = UpdateStatus.Succeeded;
                    pkg.StatusDetail = $"Updated to {installedVersion}";
                    _updates.Remove(pkg);
                    _allResults.RemoveAll(p => string.Equals(p.Id, pkg.Id, StringComparison.OrdinalIgnoreCase));
                }
                else
                {
                    pkg.Status = UpdateStatus.Failed;
                    pkg.StatusDetail = installedVersion is null
                        ? "winget reported success, but the installed version couldn't be verified afterward."
                        : $"winget reported success, but the installed version is still {installedVersion}.";
                }
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

    /// <summary>
    /// Some installers finish and exit before Windows' installed-programs registry
    /// entry is fully updated (e.g. a deferred MSI custom action completing a moment
    /// after the main process exits), so checking the installed version once,
    /// immediately, can catch it mid-update and see the stale pre-upgrade version.
    /// Retries a few times with a short delay before giving up.
    /// </summary>
    private async Task<string?> GetInstalledVersionWithRetryAsync(string packageId, string previousVersion)
    {
        string? lastSeen = null;
        for (var attempt = 0; attempt < 3; attempt++)
        {
            if (attempt > 0)
            {
                await Task.Delay(TimeSpan.FromSeconds(2));
            }

            lastSeen = await _winget.GetInstalledVersionAsync(packageId);
            if (!string.IsNullOrWhiteSpace(lastSeen) &&
                !string.Equals(lastSeen, previousVersion, StringComparison.OrdinalIgnoreCase))
            {
                return lastSeen;
            }
        }

        return lastSeen;
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
