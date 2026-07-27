namespace VeloSysPro
{
    /// <summary>
    /// A timestamped set of internal system metrics captured before and after a batch of Tweaks,
    /// so the gain can be shown without a third-party benchmark.
    /// </summary>
    /// <remarks>
    /// Every field is a number, a bool, or an ISO 8601 UTC timestamp: this record crosses the IPC
    /// boundary and is persisted, so it must never carry a culture-formatted or localized string
    /// (see .agents/rules/locale-neutral-boundary-data.md). A metric the host could not read is
    /// reported as 0 rather than omitted, so the frontend always renders a complete diff.
    /// </remarks>
    public sealed record OptimizationSnapshot(
        string CapturedAt,
        long BootDurationMs,
        long FreeMemoryBytes,
        long TotalMemoryBytes,
        long FreeDiskBytes,
        long TotalDiskBytes,
        int AutomaticServices,
        int RunningServices,
        int StartupApps,
        bool PendingReboot,
        /// <summary>
        /// When Windows last booted, ISO 8601 UTC. This is the Snapshot's boot identity: two
        /// Snapshots sharing it were taken in the same session, so their boot duration is
        /// necessarily identical and comparing them says nothing. Empty when unreadable, and on
        /// rows written before this field existed.
        /// </summary>
        string LastBootUpTime = ""
    );
}
