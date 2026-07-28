using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace VeloSysPro
{
    /// <summary>
    /// A Tweak that activates a higher-performance Windows power scheme, capturing the exact scheme
    /// GUID that was active so a single Revert puts the machine back on it.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Everything is done through <c>powercfg</c>, and everything is read as a <b>GUID</b>. Its
    /// output is localized down to the label of the surrounding sentence — a pt-BR machine prints
    /// <c>GUID do Esquema de Energia: 381b4222-… (Equilibrado)</c>, verified on 2026-07-27 — so
    /// matching on "High performance" would work in exactly one Windows display language.
    /// </para>
    /// <para>
    /// The scheme GUIDs themselves are fixed by Windows and identical everywhere, which is what
    /// makes this Tweak locale-neutral. No scheme is ever created or deleted: if the machine offers
    /// neither eligible scheme, Apply fails and says so rather than inventing one.
    /// </para>
    /// </remarks>
    public sealed class PowerPlanTweak : ITweak
    {
        private const string ActiveSchemeSetting = "ActiveScheme";

        /// <summary>The GUID is interpolated into a command line, so nothing else may pass.</summary>
        private static readonly Regex SchemeGuid =
            new(@"^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$", RegexOptions.Compiled);

        private static readonly Regex AnySchemeGuid =
            new(@"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}", RegexOptions.Compiled);

        /// <summary>
        /// The built-in schemes this Tweak will move to, best first. Ultimate Performance ships
        /// hidden and is missing from most consumer installs, so High is the usual outcome.
        /// </summary>
        private static readonly string[] PreferredSchemes =
        {
            "e9a42b02-d5df-448d-aa00-03f14749eb61", // Ultimate Performance
            "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c", // High performance
        };

        private readonly ICommandRunner _cmd;

        public PowerPlanTweak(string id, string category, RiskTier riskTier, ICommandRunner cmd)
        {
            Id = id;
            Category = category;
            RiskTier = riskTier;
            _cmd = cmd;
        }

        public string Id { get; }
        public string Category { get; }
        public RiskTier RiskTier { get; }
        public string Kind => TweakKinds.Power;

        /// <summary>A scheme switch is live the moment powercfg returns.</summary>
        public bool RequiresReboot => false;

        public TweakState Detect() =>
            IsPreferred(ReadActiveScheme()) ? TweakState.Applied : TweakState.NotApplied;

        public IReadOnlyList<CapturedValue> ReadCurrentValues()
        {
            string active = ReadActiveScheme();
            return new List<CapturedValue>
            {
                new(ActiveSchemeSetting, "", active, active.Length > 0),
            };
        }

        public TweakCapture Capture() => new(Id, Kind, TweakClock.NowUtc(), ReadCurrentValues());

        public bool Apply(TweakCapture capture)
        {
            // A capture that never read the active scheme is one Revert refuses, so switching now
            // would move the machine with no way back — the one outcome a reversible Tweak may not
            // produce. Fail instead, and let the batch report it.
            if (capture.Values.Count == 0 || !capture.Values[0].Existed) return false;

            // Read the scheme off the capture the engine just took, so the decision is made against
            // the same state Revert will restore. A machine already on an eligible scheme is left
            // alone: moving Ultimate to High would be a downgrade reported as an optimization.
            string current = capture.Values[0].Data;
            if (IsPreferred(current)) return true;

            string? target = FirstAvailablePreferredScheme();
            if (target == null) return false;

            return SetActive(target);
        }

        public bool Revert(TweakCapture capture)
        {
            bool ok = true;
            foreach (CapturedValue value in capture.Values)
            {
                // An unread scheme is not something to restore: guessing here would move the
                // machine to a plan it was never on.
                if (!value.Existed) return false;
                ok &= SetActive(value.Data);
            }
            return ok;
        }

        private static bool IsPreferred(string guid) =>
            Array.Exists(
                PreferredSchemes,
                scheme => string.Equals(scheme, guid, StringComparison.OrdinalIgnoreCase)
            );

        private bool SetActive(string guid)
        {
            if (!SchemeGuid.IsMatch(guid)) return false;
            return _cmd.Run("powercfg.exe", "/setactive " + guid).Success;
        }

        /// <summary>The active scheme's GUID, or an empty string when powercfg could not be read.</summary>
        private string ReadActiveScheme()
        {
            CaptureResult query = _cmd.RunCapture("powercfg.exe", "/getactivescheme");
            if (!query.Success) return "";

            Match match = AnySchemeGuid.Match(query.Output);
            return match.Success ? match.Value : "";
        }

        /// <summary>The best eligible scheme the machine actually has, or null if it has neither.</summary>
        private string? FirstAvailablePreferredScheme()
        {
            CaptureResult query = _cmd.RunCapture("powercfg.exe", "/list");
            if (!query.Success) return null;

            var installed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (Match match in AnySchemeGuid.Matches(query.Output)) installed.Add(match.Value);

            foreach (string scheme in PreferredSchemes)
            {
                if (installed.Contains(scheme)) return scheme;
            }
            return null;
        }
    }
}
