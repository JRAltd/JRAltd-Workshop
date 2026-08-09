using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace JRAltdIncProgramUpdater.Models;

public sealed class UpdatePackage : INotifyPropertyChanged
{
    private UpdateStatus _status = UpdateStatus.Pending;
    private string? _statusDetail;

    public required string Name { get; init; }
    public required string Id { get; init; }
    public required string CurrentVersion { get; init; }
    public required string AvailableVersion { get; init; }
    public required string Source { get; init; }

    public UpdateStatus Status
    {
        get => _status;
        set
        {
            if (_status == value) return;
            _status = value;
            OnPropertyChanged();
        }
    }

    /// <summary>Latest raw output line from winget for this package, shown as a live detail/tooltip.</summary>
    public string? StatusDetail
    {
        get => _statusDetail;
        set
        {
            if (_statusDetail == value) return;
            _statusDetail = value;
            OnPropertyChanged();
        }
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    private void OnPropertyChanged([CallerMemberName] string? propertyName = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}
