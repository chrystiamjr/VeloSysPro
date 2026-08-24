using System;
using System.Collections.Generic;

namespace VeloSysPro
{
    /// <summary>
    /// A Tweak that only means anything on a machine which has the feature it configures.
    /// </summary>
    /// <remarks>
    /// A decorator rather than a flag on each Tweak class, because the question — "does this
    /// machine have the thing at all?" — is asked of a capability, not of a registry value, and the
    /// answer is the same whether the Tweak underneath writes the registry, a service or a boot
    /// entry. <c>windows.recall</c> is the first case; Memory Integrity and the Xbox services are
    /// the next two.
    ///
    /// It deliberately does not gate <see cref="Revert"/>. A capture only exists because the Tweak
    /// was applied while the machine still had the feature, and refusing to undo it there would
    /// strand the user with a change they can no longer take back.
    /// </remarks>
    public sealed class SupportGatedTweak : ITweak
    {
        private readonly ITweak _inner;
        private readonly Func<bool> _isSupported;

        /// <param name="isSupported">
        /// Read live on every call rather than at construction: the catalog is built once at
        /// startup and detection runs on every refresh, so a machine that gains the feature starts
        /// reporting normally without anything stored to invalidate.
        /// </param>
        public SupportGatedTweak(ITweak inner, Func<bool> isSupported)
        {
            _inner = inner;
            _isSupported = isSupported;
        }

        public string Id => _inner.Id;
        public string Category => _inner.Category;
        public RiskTier RiskTier => _inner.RiskTier;
        public string Kind => _inner.Kind;
        public bool RequiresReboot => _inner.RequiresReboot;

        public TweakState Detect() =>
            _isSupported() ? _inner.Detect() : TweakState.Unsupported;

        public IReadOnlyList<CapturedValue> ReadCurrentValues() => _inner.ReadCurrentValues();

        public TweakCapture Capture() => _inner.Capture();

        /// <summary>
        /// Refuses on an unsupported machine, so the refusal survives a caller that never asked
        /// <see cref="Detect"/> first.
        /// </summary>
        public bool Apply(TweakCapture capture) => _isSupported() && _inner.Apply(capture);

        public bool Revert(TweakCapture capture) => _inner.Revert(capture);
    }

    /// <summary>
    /// Asks Windows whether an optional feature exists in this image at all.
    /// </summary>
    /// <remarks>
    /// The signal has to be the capability, never the policy value's own absence: an unset policy
    /// on a Copilot+ PC and a machine that has never heard of Recall look identical in the
    /// registry. <c>Win32_OptionalFeature</c> answers the right question — it lists the features
    /// this Windows image knows about — and it answers it without elevation, which
    /// <c>dism /online</c> and <c>Get-WindowsOptionalFeature</c> both refuse to do.
    ///
    /// Verified on a real machine on 2026-08-23 (Windows 11 Pro 26200): <c>Recall</c> returns no
    /// row, <c>TelnetClient</c> returns one. The positive control matters as much as the negative —
    /// a query that could only ever answer "absent" would report every machine as unsupported.
    ///
    /// The name and the tokens are locale-neutral by construction: the class name and the feature
    /// names are invariant, and the script prints tokens of our own rather than anything Windows
    /// translates.
    /// </remarks>
    public sealed class WindowsOptionalFeatures
    {
        private const string Present = "present";

        private readonly ICommandRunner _cmd;

        /// <summary>
        /// Answers are remembered for the life of the process: the round trip costs a PowerShell
        /// start plus a WMI query — measured at roughly two seconds — and detection runs for every
        /// Tweak on every refresh of the screen. Installing or removing a Windows optional feature
        /// requires a restart, which restarts this process with it, so the cache cannot outlive the
        /// answer it holds.
        /// </summary>
        private readonly Dictionary<string, bool> _answers = new(StringComparer.OrdinalIgnoreCase);

        public WindowsOptionalFeatures(ICommandRunner cmd) => _cmd = cmd;

        public bool Exists(string featureName)
        {
            if (_answers.TryGetValue(featureName, out bool known)) return known;

            bool exists = Query(featureName);
            _answers[featureName] = exists;
            return exists;
        }

        private bool Query(string featureName)
        {
            // Only ever called with a literal from the catalog, but the name is interpolated into a
            // PowerShell string, so anything that could close the quote is refused rather than run.
            foreach (char character in featureName)
            {
                if (!char.IsLetterOrDigit(character) && character != '-' && character != '_')
                    return false;
            }

            // Single quotes throughout: the script is already wrapped in the double quotes that
            // carry it across the process boundary (the pattern ServiceTweak documents).
            string ps =
                "$f = Get-CimInstance -ClassName Win32_OptionalFeature -ErrorAction SilentlyContinue"
                + " | Where-Object { $_.Name -eq '"
                + featureName
                + "' }; if ($f) { '"
                + Present
                + "' } else { 'absent' }";

            CaptureResult query = _cmd.RunCapture(
                "powershell.exe",
                "-ExecutionPolicy Bypass -Command \"" + ps + "\""
            );

            // Only a query that ran and named the feature counts as present. A WMI call that failed
            // proves nothing either way, and between hiding a feature behind a row that explains
            // itself and offering to write a policy for a feature nobody could confirm is there,
            // the first is the one that cannot mislead.
            return query.Success
                && string.Equals(query.Output.Trim(), Present, StringComparison.Ordinal);
        }
    }
}
