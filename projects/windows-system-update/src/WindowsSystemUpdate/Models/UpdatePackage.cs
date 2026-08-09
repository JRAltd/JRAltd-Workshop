namespace WindowsSystemUpdate.Models;

public sealed class UpdatePackage
{
    public required string Name { get; init; }
    public required string Id { get; init; }
    public required string CurrentVersion { get; init; }
    public required string AvailableVersion { get; init; }
    public required string Source { get; init; }
}
