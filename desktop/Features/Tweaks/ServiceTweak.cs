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

        public TweakState Detect() =>
            string.Equals(ReadStartType(), _desiredStartType, StringComparison.OrdinalIgnoreCase)
                ? TweakState.Applied
                : TweakState.NotApplied;

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

        public bool Apply(TweakCapture capture) => Configure(_desiredStartType);

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
