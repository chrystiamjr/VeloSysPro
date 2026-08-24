using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
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
        /// <summary>
        /// Value names and data reach a command line, and Revert data comes off disk.
        /// </summary>
        /// <remarks>
        /// Spaces are allowed because Windows itself uses them — the MMCSS Games task spells its
        /// values <c>GPU Priority</c> and <c>Scheduling Category</c> — which is why every name is
        /// quoted where it is interpolated. A quote character is rejected outright, so the quoting
        /// cannot be escaped out of.
        /// </remarks>
        private static readonly Regex SafeValueName = new(@"^[A-Za-z0-9_.\- ]+$", RegexOptions.Compiled);

        private static readonly HashSet<string> SafeValueTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "REG_SZ", "REG_MULTI_SZ", "REG_EXPAND_SZ", "REG_DWORD", "REG_QWORD", "REG_BINARY", "REG_NONE",
        };

        private readonly string _keyPath;
        private readonly IReadOnlyList<RegistryValue> _values;
        private readonly ICommandRunner _cmd;
        private readonly RegistryBackupManager _backup;
        private readonly bool _requiresExistingValue;
        private readonly bool _keyMayBeAbsent;

        /// <param name="requiresExistingValue">
        /// When true, Apply refuses to create a value that is not already there. This is for the
        /// settings Windows writes itself only where the hardware supports the feature — GPU
        /// Hardware Scheduling being the one that ships: creating <c>HwSchMode</c> on a machine
        /// where Windows never did would report a success the driver is going to ignore.
        /// </param>
        /// <param name="keyMayBeAbsent">
        /// True when the key itself not existing is a legitimate prior state that Revert has to be
        /// able to restore — a <c>Policies</c> branch nobody has created yet, which is the normal
        /// condition of every policy this catalog writes.
        /// </param>
        public RegistryTweak(
            string id,
            string category,
            RiskTier riskTier,
            string keyPath,
            IReadOnlyList<RegistryValue> values,
            ICommandRunner cmd,
            RegistryBackupManager backup,
            bool requiresReboot = false,
            bool requiresExistingValue = false,
            bool keyMayBeAbsent = false
        )
        {
            Id = id;
            Category = category;
            RiskTier = riskTier;
            RequiresReboot = requiresReboot;
            _keyPath = keyPath;
            _values = values;
            _cmd = cmd;
            _backup = backup;
            _requiresExistingValue = requiresExistingValue;
            _keyMayBeAbsent = keyMayBeAbsent;
        }

        public string Id { get; }
        public string Category { get; }
        public RiskTier RiskTier { get; }
        public bool RequiresReboot { get; }
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

        public IReadOnlyList<CapturedValue> ReadCurrentValues() => ReadCurrentValues(KeyIsReadable());

        /// <summary>
        /// Takes the key-readable answer rather than asking again, so <see cref="Capture"/> can use
        /// the same one to decide whether there is a key worth exporting.
        /// </summary>
        private IReadOnlyList<CapturedValue> ReadCurrentValues(bool keyIsReadable)
        {
            // "reg query" fails both for a value that is absent and for a key it could not read at
            // all, and those must not be confused: recording "absent" for a value that exists would
            // make Revert delete it. Only when the key itself reads back is an absent value real.
            var captured = new List<CapturedValue>(_values.Count);
            if (!keyIsReadable)
            {
                // ...unless the key's absence is the prior state itself. A `Policies` branch that
                // nobody has created is the normal condition of every policy here, and it takes the
                // whole-key export down with it — leaving Revert with neither values to restore nor
                // an archive to import, so the policy would stay applied for good. Recording every
                // value as absent is what the machine actually said, and Revert then deletes what
                // Apply created. Off everywhere else, where an unreadable key is more likely to
                // mean "could not read" than "is not there".
                if (!_keyMayBeAbsent) return captured;

                foreach (RegistryValue value in _values)
                    captured.Add(new CapturedValue(value.Name, value.Type, "", false));
                return captured;
            }

            foreach (RegistryValue value in _values) captured.Add(Read(value));
            return captured;
        }

        public TweakCapture Capture()
        {
            bool keyIsReadable = KeyIsReadable();
            return new(
                Id,
                Kind,
                TweakClock.NowUtc(),
                ReadCurrentValues(keyIsReadable),
                // Exporting a key that is not there fails, and reg.exe's complaint reaches the
                // user's log as a red error line beside a step that actually succeeded — seen on a
                // real machine on 2026-08-23, applying the Delivery Optimization policy. There is
                // nothing to archive either: the capture already holds the whole prior state, which
                // for an absent policy key is "no policy set".
                keyIsReadable ? _backup.ExportKey(_keyPath, Id) : "",
                keyIsReadable
            );
        }

        public bool Apply(TweakCapture capture)
        {
            // Read off the capture the engine took a moment ago rather than querying again, so the
            // decision is made against the same state that Revert will restore.
            if (_requiresExistingValue && !EveryValueExistsIn(capture)) return false;

            bool ok = true;
            foreach (RegistryValue value in _values) ok &= Write(value.Name, value.Type, value.Data);
            return ok;
        }

        private bool EveryValueExistsIn(TweakCapture capture) =>
            _values.All(value =>
                capture.Values.Any(captured =>
                    captured.Existed
                    && string.Equals(captured.Name, value.Name, StringComparison.OrdinalIgnoreCase)
                )
            );

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

            // Apply created the key along with the value, so leaving it behind is an artefact the
            // app made and did not clean up. Only ever for a key this Tweak is allowed to create,
            // only when the capture saw it absent, and only when nothing is left in it: between
            // Apply and Revert an administrator may have set another policy under the same branch,
            // and deleting the branch wholesale would destroy their setting — a far worse failure
            // than the leftover key (#51). A restore that already failed is left exactly as it is.
            if (ok && !capture.KeyExisted && _keyMayBeAbsent && KeyIsEmpty()) ok &= DeleteKey();

            return ok;
        }

        /// <summary>
        /// True when the key reads back holding nothing at all — no values, no subkeys.
        /// </summary>
        /// <remarks>
        /// Read on a real machine on 2026-08-23: reg.exe answers an empty key with exit 0 and a
        /// single line break, not even echoing the key's own path, while a key holding anything
        /// prints that path and a line per value or subkey. So "no non-blank line" is the whole
        /// test, and it needs nothing Windows translates — the alternative, reading the localized
        /// text of a failure, is the trap `.agents/rules/locale-neutral-boundary-data.md` names.
        ///
        /// A query that fails answers nothing, and nothing is not permission to delete.
        /// </remarks>
        private bool KeyIsEmpty()
        {
            CaptureResult query = _cmd.RunCapture("reg.exe", "query \"" + _keyPath + "\"");
            if (!query.Success) return false;

            foreach (string line in query.Output.Split('\n'))
            {
                if (line.Trim().Length > 0) return false;
            }
            return true;
        }

        private bool DeleteKey() =>
            _cmd.Run("reg.exe", "delete \"" + _keyPath + "\" /f").Success;

        private bool KeyIsReadable() =>
            _cmd.RunCapture("reg.exe", "query \"" + _keyPath + "\"").Success;

        private CapturedValue Read(RegistryValue value)
        {
            CaptureResult query = _cmd.RunCapture(
                "reg.exe",
                "query \"" + _keyPath + "\" /v \"" + value.Name + "\""
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
                    "add \"" + _keyPath + "\" /v \"" + name + "\" /t " + type + " /d \""
                        + EscapeTrailingBackslashes(data)
                        + "\" /f"
                )
                .Success;
        }

        /// <summary>
        /// Doubles a run of backslashes at the very end of the data, so the closing quote stays a
        /// closing quote.
        /// </summary>
        /// <remarks>
        /// Windows argument parsing only treats a backslash as an escape immediately before a
        /// quote, so <c>/d "C:\dir\"</c> would hand reg.exe an unterminated argument and let the
        /// rest of the command line be reinterpreted. Rejecting a literal quote is not enough on
        /// its own. Revert is the path that matters: its data comes back off a capture file rather
        /// than from the catalog.
        /// </remarks>
        private static string EscapeTrailingBackslashes(string data)
        {
            int trailing = data.Length - data.TrimEnd('\\').Length;
            return trailing == 0 ? data : data + new string('\\', trailing);
        }

        private bool Delete(string name)
        {
            if (!SafeValueName.IsMatch(name)) return false;
            return _cmd.Run("reg.exe", "delete \"" + _keyPath + "\" /v \"" + name + "\" /f").Success;
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
