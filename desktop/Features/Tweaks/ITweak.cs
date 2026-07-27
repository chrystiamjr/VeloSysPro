using System.Collections.Generic;

namespace VeloSysPro
{
    /// <summary>The result of detecting a Tweak against the live system.</summary>
    public enum TweakState
    {
        NotApplied,
        Applied,

        /// <summary>Some of a multi-value Tweak's settings match, others do not.</summary>
        Partial,
    }

    /// <summary>
    /// A Tweak's safety classification. Advanced Tweaks may reduce security, are never selected by
    /// default, and are rejected from Presets (docs/adr/0005-advanced-risk-tier.md).
    /// </summary>
    public enum RiskTier
    {
        Safe,
        Advanced,
    }

    /// <summary>One setting's exact prior state: enough to put it back byte for byte.</summary>
    /// <param name="Name">Registry value name, BCD element, or "StartType" for a service.</param>
    /// <param name="Type">Registry type (REG_DWORD…); empty for BCD and services.</param>
    /// <param name="Data">The prior value, locale-neutral. Empty when <paramref name="Existed"/> is false.</param>
    /// <param name="Existed">False when the setting was absent before the Tweak was applied.</param>
    public sealed record CapturedValue(string Name, string Type, string Data, bool Existed);

    /// <summary>
    /// The per-Tweak half of a Safety Checkpoint: what the system looked like immediately before a
    /// Tweak was applied, which is what makes a single in-app Revert possible without a reboot.
    /// </summary>
    /// <param name="ArtifactFile">
    /// For registry Tweaks, the exported <c>.reg</c> of the whole key. Revert restores the captured
    /// values individually — the export is the archive kept for manual recovery, and the fallback
    /// when a capture's values cannot be read.
    /// </param>
    public sealed record TweakCapture(
        string TweakId,
        string Kind,
        string CapturedAt,
        IReadOnlyList<CapturedValue> Values,
        string ArtifactFile = ""
    );

    /// <summary>
    /// An individually selectable optimization that knows how to detect, apply, and revert itself.
    /// </summary>
    /// <remarks>
    /// Every implementation reaches the system exclusively through <see cref="ICommandRunner"/>, so
    /// tests drive detect/apply/revert against an in-memory fake and no real machine is touched.
    /// </remarks>
    public interface ITweak
    {
        /// <summary>Stable identifier used by Presets, the IPC payload, and the capture store.</summary>
        string Id { get; }

        /// <summary>Grouping key for the selection screen (cpu, boot, services…).</summary>
        string Category { get; }

        RiskTier RiskTier { get; }

        /// <summary>Kind of capture this Tweak produces: registry, bcd, or service.</summary>
        string Kind { get; }

        /// <summary>Reads the live system. Never mutates anything.</summary>
        TweakState Detect();

        /// <summary>
        /// The Tweak's settings exactly as they are right now, with no archiving side effect.
        /// This is what makes an honest "what changed" report possible: the engine reads it once
        /// before applying and once after, so the report states what the system actually holds
        /// rather than what the catalog intended to write.
        /// </summary>
        IReadOnlyList<CapturedValue> ReadCurrentValues();

        /// <summary>Records the exact prior state so <see cref="Revert"/> can restore it.</summary>
        TweakCapture Capture();

        /// <summary>Applies the Tweak. The capture is the one taken immediately before.</summary>
        bool Apply(TweakCapture capture);

        /// <summary>Restores the captured prior state.</summary>
        bool Revert(TweakCapture capture);
    }

    /// <summary>
    /// One setting a batch actually changed, read off the live system before and after.
    /// </summary>
    /// <remarks>
    /// This is the only part of the report that is fully attributable to the Tweaks applied: the
    /// system metrics around it move for reasons of their own. An empty <paramref name="Before"/>
    /// or <paramref name="After"/> means the setting was absent at that moment.
    /// </remarks>
    public sealed record TweakChange(string TweakId, string Setting, string Before, string After);

    /// <summary>
    /// The one way a capture or Snapshot is timestamped: UTC, round-trippable, culture invariant.
    /// These strings are persisted and cross the IPC boundary, so a local or localized format here
    /// would break both the store and the frontend's sorting.
    /// </summary>
    public static class TweakClock
    {
        public static string NowUtc() =>
            System.DateTime.UtcNow.ToString("O", System.Globalization.CultureInfo.InvariantCulture);
    }

    /// <summary>Capture kinds, matching the three revert mechanisms.</summary>
    public static class TweakKinds
    {
        public const string Registry = "registry";
        public const string Bcd = "bcd";
        public const string Service = "service";
    }

    /// <summary>Selection-screen groupings. Kept as constants so the UI can translate them by key.</summary>
    public static class TweakCategories
    {
        public const string Cpu = "cpu";
        public const string Boot = "boot";
        public const string Services = "services";
    }
}
