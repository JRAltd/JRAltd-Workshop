namespace JRAltdIncProgramUpdater.Models;

/// <summary>
/// A package WinGet itself refuses to install (e.g. a stale installer hash in its
/// package manifest) -- not something a retry or a fresh "Check for Updates" scan
/// will fix on its own. Kept out of the main Updates list and tracked here instead,
/// persisted, until the user explicitly unblocks it.
/// </summary>
public sealed class BlockedPackage
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Reason { get; init; }
}
