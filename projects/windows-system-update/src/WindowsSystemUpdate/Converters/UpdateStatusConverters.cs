using System.Globalization;
using System.Windows.Data;
using System.Windows.Media;
using WindowsSystemUpdate.Models;

namespace WindowsSystemUpdate.Converters;

public sealed class UpdateStatusToTextConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture) => value switch
    {
        UpdateStatus.Pending => "Pending",
        UpdateStatus.InProgress => "Updating…",
        UpdateStatus.Succeeded => "Updated",
        UpdateStatus.Failed => "Failed",
        _ => string.Empty
    };

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public sealed class UpdateStatusToBrushConverter : IValueConverter
{
    private static readonly SolidColorBrush PendingBrush = new(Color.FromRgb(0x9D, 0xB0, 0xBB));
    private static readonly SolidColorBrush InProgressBrush = new(Color.FromRgb(0x2F, 0xD8, 0xEF));
    private static readonly SolidColorBrush SucceededBrush = new(Color.FromRgb(0x3D, 0xD9, 0x8C));
    private static readonly SolidColorBrush FailedBrush = new(Color.FromRgb(0xE5, 0x5B, 0x5B));

    public object Convert(object value, Type targetType, object parameter, CultureInfo culture) => value switch
    {
        UpdateStatus.InProgress => InProgressBrush,
        UpdateStatus.Succeeded => SucceededBrush,
        UpdateStatus.Failed => FailedBrush,
        _ => PendingBrush
    };

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}
