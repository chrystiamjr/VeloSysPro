using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.RegularExpressions;

namespace VeloSysPro
{
    /// <summary>One registry setting a Tweak owns: the value name, its type, and the desired data.</summary>
    public sealed record RegistryValue(string Name, string Type, string Data);

    /// <summary>
    /// A Tweak backed by one or more values under a single registry key.
    /// </summary>
    /// <remarks>
    /// Grouping several values under one Tweak is what gives <see cref="TweakState.Partial"/> a
    /// meaning: the MMCSS and TCP groups set three or four values at once, and a half-applied group
    /// must be visible to the user rather than rounded to "applied" or "not applied".
    /// </remarks>
    public sealed class RegistryTweak : ITweak
    {
        /// <summary>Value names and data reach a command line, and Revert data comes off disk.</summary>
        private static readonly Regex SafeValueName = new(@"^[A-Za-z0-9_.\- ]+$", RegexOptions.Compiled);

        private static readonly HashSet<string> SafeValueTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "REG_SZ", "REG_MULTI_SZ", "REG_EXPAND_SZ", "REG_DWORD", "REG_QWORD", "REG_BINARY", "REG_NONE",
        };

        private readonly string _keyPath;
        private readonly IReadOnlyList<RegistryValue> _values;
        private readonly ICommandRunner _cmd;
        private readonly RegistryBackupManager _backup;

        public RegistryTweak(
            string id,
            string category,
            RiskTier riskTier,
            string keyPath,
            IReadOnlyList<RegistryValue> values,
            ICommandRunner cmd,
            RegistryBackupManager backup
        )
        {
            Id = id;
            Category = category;
            RiskTier = riskTier;
            _keyPath = keyPath;
            _values = values;
            _cmd = cmd;
            _backup = backup;
        }

        public string Id { get; }
        public string Category { get; }
        public RiskTier RiskTier { get; }
        public string Kind => TweakKinds.Registry;

        public TweakState Detect()
        {
            int matches = 0;
            foreach (RegistryValue value in _values)
            {
                CapturedValue live = Read(value);
                if (live.Existed && SameData(value.Type, live.Data, value.Data)) matches++;
            }

            if (matches == _values.Count) return TweakState.Applied;
            return matches == 0 ? TweakState.NotApplied : TweakState.Partial;
        }

        public TweakCapture Capture()
        {
            // "reg query" fails both for a value that is absent and for a key it could not read at
            // all, and those must not be confused: recording "absent" for a value that exists would
            // make Revert delete it. Only when the key itself reads back is an absent value real.
            var captured = new List<CapturedValue>(_values.Count);
            if (KeyIsReadable())
            {
                foreach (RegistryValue value in _values) captured.Add(Read(value));
            }

            return new TweakCapture(
                Id,
                Kind,
                TweakClock.NowUtc(),
                captured,
                _backup.ExportKey(_keyPath, Id)
            );
        }

        public bool Apply(TweakCapture capture)
        {
            bool ok = true;
            foreach (RegistryValue value in _values) ok &= Write(value.Name, value.Type, value.Data);
            return ok;
        }

        public bool Revert(TweakCapture capture)
        {
            // No recorded values means the key could not be read when the Tweak was applied. Falling
            // back to the whole-key archive is the only honest undo; deleting values on the strength
            // of a state we never observed would be worse than reporting failure.
            if (capture.Values.Count == 0) return _backup.ImportKey(capture.ArtifactFile);

            bool ok = true;
            foreach (CapturedValue value in capture.Values)
            {
                if (!SafeValueName.IsMatch(value.Name)) return false;
                ok &= value.Existed
                    ? Write(value.Name, value.Type, value.Data)
                    : Delete(value.Name);
            }
            return ok;
        }

        private bool KeyIsReadable() =>
            _cmd.RunCapture("reg.exe", "query \"" + _keyPath + "\"").Success;

        private CapturedValue Read(RegistryValue value)
        {
            CaptureResult query = _cmd.RunCapture(
                "reg.exe",
                "query \"" + _keyPath + "\" /v " + value.Name
            );
            if (!query.Success) return new CapturedValue(value.Name, value.Type, "", false);

            foreach (string rawLine in query.Output.Split('\n'))
            {
                string line = rawLine.Trim();
                if (line.Length == 0) continue;

                // "<name>    <type>    <data>" — data may itself contain spaces (REG_SZ).
                string[] parts = Regex.Split(line, @"\s{2,}|\t+");
                if (parts.Length < 3) continue;
                if (!string.Equals(parts[0], value.Name, StringComparison.OrdinalIgnoreCase)) continue;

                return new CapturedValue(
                    value.Name,
                    parts[1].Trim(),
                    string.Join(" ", parts, 2, parts.Length - 2).Trim(),
                    true
                );
            }

            return new CapturedValue(value.Name, value.Type, "", false);
        }

        private bool Write(string name, string type, string data)
        {
            if (!SafeValueName.IsMatch(name)) return false;
            if (!SafeValueTypes.Contains(type)) return false;
            if (data.Contains('"')) return false;

            return _cmd
                .Run(
                    "reg.exe",
                    "add \"" + _keyPath + "\" /v " + name + " /t " + type + " /d \"" + data + "\" /f"
                )
                .Success;
        }

        private bool Delete(string name)
        {
            if (!SafeValueName.IsMatch(name)) return false;
            return _cmd.Run("reg.exe", "delete \"" + _keyPath + "\" /v " + name + " /f").Success;
        }

        /// <summary>
        /// Compares registry data the way the registry means it: reg.exe prints DWORDs in hex
        /// ("0x26") while the catalog writes them in decimal ("38"), so a textual comparison would
        /// report every numeric Tweak as not applied.
        /// </summary>
        private static bool SameData(string type, string actual, string desired)
        {
            if (
                string.Equals(type, "REG_DWORD", StringComparison.OrdinalIgnoreCase)
                || string.Equals(type, "REG_QWORD", StringComparison.OrdinalIgnoreCase)
            )
            {
                return TryParseNumber(actual, out ulong left)
                    && TryParseNumber(desired, out ulong right)
                    && left == right;
            }

            return string.Equals(actual, desired, StringComparison.OrdinalIgnoreCase);
        }

        private static bool TryParseNumber(string raw, out ulong value)
        {
            string text = raw.Trim();
            if (text.StartsWith("0x", StringComparison.OrdinalIgnoreCase))
            {
                return ulong.TryParse(
                    text.Substring(2),
                    NumberStyles.HexNumber,
                    CultureInfo.InvariantCulture,
                    out value
                );
            }

            return ulong.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out value);
        }
    }
}
