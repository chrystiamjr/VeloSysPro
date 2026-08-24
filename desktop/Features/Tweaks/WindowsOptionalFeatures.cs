using System;
using System.Collections.Generic;

namespace VeloSysPro
{
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
