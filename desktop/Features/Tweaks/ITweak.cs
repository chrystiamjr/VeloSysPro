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

        /// <summary>
        /// This machine does not have the feature the Tweak configures, so there is nothing here to
        /// apply.
        /// </summary>
        /// <remarks>
        /// Distinct from <see cref="NotApplied"/> on purpose. Recall exists only on a Copilot+ PC;
        /// on any other machine its policy write succeeds and configures a feature that is not
        /// there. Folded into <see cref="NotApplied"/> the row invites the user to apply it and
        /// then reports <see cref="Applied"/> for a change with no effect — the exact "reports
        /// success while changing nothing" failure this catalog is built to avoid.
        /// Nothing about it is persisted: it is re-read on every refresh, so a machine that gains
        /// the feature starts reporting normally with no stored state to invalidate.
        /// </remarks>
        Unsupported,
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

        /// <summary>Kind of capture this Tweak produces: registry, bcd, service, or power.</summary>
        string Kind { get; }

        /// <summary>
        /// True when the setting is written immediately but only takes effect after a restart.
        /// </summary>
        /// <remarks>
        /// Structured rather than a sentence in the description, because two things branch on it:
        /// the UI badges the row, and <see cref="TweakCatalog"/> refuses to recommend such a Tweak.
        /// Deriving either from translated copy would make them wrong in one language.
        /// </remarks>
        bool RequiresReboot { get; }

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

    /// <summary>Capture kinds, matching the four revert mechanisms.</summary>
    public static class TweakKinds
    {
        public const string Registry = "registry";
        public const string Bcd = "bcd";
        public const string Service = "service";
        public const string Power = "power";
    }

    /// <summary>Selection-screen groupings. Kept as constants so the UI can translate them by key.</summary>
    public static class TweakCategories
    {
        public const string Cpu = "cpu";
        public const string Graphics = "graphics";
        public const string Network = "network";
        public const string System = "system";
        public const string Boot = "boot";
        public const string Services = "services";

        /// <summary>
        /// What Windows itself puts in front of the user: suggestions, Copilot, Recall. Grouped by
        /// what someone recognizes rather than by hive — these live in three different keys and one
        /// of them is a policy.
        /// </summary>
        public const string Windows = "windows";
    }
}
