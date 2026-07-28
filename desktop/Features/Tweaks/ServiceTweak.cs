using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.RegularExpressions;

namespace VeloSysPro
{
    /// <summary>
    /// A Tweak that changes a Windows service's start type, capturing the prior one so a single
    /// Revert puts the service back exactly as Windows had it.
    /// </summary>
    /// <remarks>
    /// The start type is read through <c>Get-Service</c> and cast with <c>[string]</c>, because
    /// <c>ServiceStartMode</c> is a .NET enum whose name is language independent, while
    /// <c>sc qc</c> prints a label translated to the Windows display language. This is the same
    /// choice <see cref="SchedulerManager"/> makes for task state, and an unrecognized value falls
    /// back to <c>Unknown</c> instead of being guessed.
    /// </remarks>
    public sealed class ServiceTweak : ITweak
    {
        private const string Unknown = "Unknown";

        /// <summary>The service name is interpolated into both a PowerShell and an sc.exe command.</summary>
        private static readonly Regex SafeServiceName = new(@"^[A-Za-z0-9_.\-]+$", RegexOptions.Compiled);

        /// <summary>ServiceStartMode names as .NET spells them, mapped to sc.exe's own tokens.</summary>
        private static readonly Dictionary<string, string> ScTokens = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Automatic"] = "auto",
            ["AutomaticDelayedStart"] = "delayed-auto",
            ["Manual"] = "demand",
            ["Disabled"] = "disabled",
            ["Boot"] = "boot",
            ["System"] = "system",
        };

        /// <summary>
        /// How eagerly each start type lets the service run — lower is quieter.
        /// </summary>
        /// <remarks>
        /// What a service Tweak actually wants is "stop this from starting on its own", and a start
        /// type quieter than the one it names already satisfies that. Comparing by rank instead of
        /// by equality is what stops the app "optimizing" a service the user had already disabled
        /// into merely Manual — which is what happened on a real machine, and read as an
        /// improvement while actually letting the service back in.
        /// </remarks>
        private static readonly Dictionary<string, int> Eagerness = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Boot"] = 5,
            ["System"] = 4,
            ["Automatic"] = 3,
            ["AutomaticDelayedStart"] = 2,
            ["Manual"] = 1,
            ["Disabled"] = 0,
        };

        private readonly string _serviceName;
        private readonly string _desiredStartType;
        private readonly ICommandRunner _cmd;

        public ServiceTweak(
            string id,
            string category,
            RiskTier riskTier,
            string serviceName,
            string desiredStartType,
            ICommandRunner cmd
        )
        {
            Id = id;
            Category = category;
            RiskTier = riskTier;
            _serviceName = serviceName;
            _desiredStartType = desiredStartType;
            _cmd = cmd;
        }

        public string Id { get; }
        public string Category { get; }
        public RiskTier RiskTier { get; }
        public string Kind => TweakKinds.Service;

        /// <summary>The start type governs the next start, so the change is live immediately.</summary>
        public bool RequiresReboot => false;

        public TweakState Detect() =>
            IsQuietEnough(ReadStartType()) ? TweakState.Applied : TweakState.NotApplied;

        /// <summary>True when the live start type is the desired one, or an even quieter one.</summary>
        private bool IsQuietEnough(string startType) =>
            Eagerness.TryGetValue(startType, out int actual)
            && Eagerness.TryGetValue(_desiredStartType, out int desired)
            && actual <= desired;

        public IReadOnlyList<CapturedValue> ReadCurrentValues()
        {
            string startType = ReadStartType();
            return new List<CapturedValue>
            {
                new("StartType", "", startType, startType != Unknown),
            };
        }

        public TweakCapture Capture() =>
            new(Id, Kind, TweakClock.NowUtc(), ReadCurrentValues());

        public bool Apply(TweakCapture capture)
        {
            // An unread start type is one Revert refuses to restore, so reconfiguring the service
            // now would leave it changed with nothing to put back. Fail rather than mutate blind.
            if (capture.Values.Count == 0 || !capture.Values[0].Existed) return false;

            // Read from the capture the engine just took rather than querying again. A service that
            // is already quieter than this Tweak asks for is left alone: writing the desired value
            // would be a downgrade dressed up as an optimization.
            string current = capture.Values[0].Data;
            return IsQuietEnough(current) || Configure(_desiredStartType);
        }

        public bool Revert(TweakCapture capture)
        {
            bool ok = true;
            foreach (CapturedValue value in capture.Values)
            {
                // An uncaptured start type is not a value to restore — writing a guess could leave
                // a service disabled that Windows needs at boot.
                if (!value.Existed) return false;
                ok &= Configure(value.Data);
            }
            return ok;
        }

        private bool Configure(string startType)
        {
            if (!SafeServiceName.IsMatch(_serviceName)) return false;
            if (!ScTokens.TryGetValue(startType, out string? token)) return false;

            return _cmd.Run("sc.exe", "config " + _serviceName + " start= " + token).Success;
        }

        private string ReadStartType()
        {
            if (!SafeServiceName.IsMatch(_serviceName)) return Unknown;

            string ps =
                "Get-Service -Name '"
                + _serviceName
                + "' -ErrorAction SilentlyContinue | ForEach-Object { [string]$_.StartType }";

            CaptureResult query = _cmd.RunCapture(
                "powershell.exe",
                "-ExecutionPolicy Bypass -Command \"" + ps + "\""
            );
            if (!query.Success) return Unknown;

            string startType = query.Output.Trim();
            return ScTokens.ContainsKey(startType) ? startType : Unknown;
        }
    }
}
