using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.RegularExpressions;

namespace VeloSysPro
{
    /// <summary>
    /// A Tweak backed by one Boot Configuration Data element on the current boot entry.
    /// </summary>
    /// <remarks>
    /// <c>bcdedit</c> is the only built-in way to read and write these. Its element *values* are
    /// rendered from a fixed table, not translated: a pt-BR Windows prints <c>Yes</c>, verified on a
    /// real machine on 2026-07-27. Only bcdedit's own messages follow the display language, and we
    /// never parse those. <see cref="BcdBoolean"/> therefore normalizes the spellings the BCD store
    /// itself uses, and an unrecognized token deliberately reads as "not applied" — visible and
    /// harmless — rather than being guessed at.
    /// </remarks>
    public sealed class BcdTweak : ITweak
    {
        /// <summary>Element names and values are interpolated into a bcdedit command line.</summary>
        private static readonly Regex SafeToken = new(@"^[A-Za-z0-9_.\-]+$", RegexOptions.Compiled);

        private readonly string _element;
        private readonly string _desiredValue;
        private readonly ICommandRunner _cmd;

        public BcdTweak(
            string id,
            string category,
            RiskTier riskTier,
            string element,
            string desiredValue,
            ICommandRunner cmd
        )
        {
            Id = id;
            Category = category;
            RiskTier = riskTier;
            _element = element;
            _desiredValue = desiredValue;
            _cmd = cmd;
        }

        public string Id { get; }
        public string Category { get; }
        public RiskTier RiskTier { get; }
        public string Kind => TweakKinds.Bcd;

        public TweakState Detect()
        {
            CapturedValue live = Read();
            return live.Existed && BcdBoolean.SameValue(live.Data, _desiredValue)
                ? TweakState.Applied
                : TweakState.NotApplied;
        }

        public IReadOnlyList<CapturedValue> ReadCurrentValues() =>
            new List<CapturedValue> { Read() };

        public TweakCapture Capture() =>
            new(Id, Kind, TweakClock.NowUtc(), ReadCurrentValues());

        public bool Apply(TweakCapture capture) => Set(_element, _desiredValue);

        public bool Revert(TweakCapture capture)
        {
            bool ok = true;
            foreach (CapturedValue value in capture.Values)
            {
                if (!SafeToken.IsMatch(value.Name)) return false;
                if (value.Existed)
                {
                    // The capture holds what bcdedit printed, which on a Portuguese machine is
                    // "Sim" — a token bcdedit will not accept back. Write the canonical form.
                    string restore = BcdBoolean.ToCommandToken(value.Data);
                    if (!SafeToken.IsMatch(restore)) return false;
                    ok &= Set(value.Name, restore);
                }
                else
                {
                    ok &= _cmd.Run("bcdedit.exe", "/deletevalue {current} " + value.Name).Success;
                }
            }
            return ok;
        }

        private bool Set(string element, string value)
        {
            if (!SafeToken.IsMatch(element) || !SafeToken.IsMatch(value)) return false;
            return _cmd.Run("bcdedit.exe", "/set {current} " + element + " " + value).Success;
        }

        private CapturedValue Read()
        {
            CaptureResult query = _cmd.RunCapture("bcdedit.exe", "/enum {current}");
            if (!query.Success) return new CapturedValue(_element, "", "", false);

            foreach (string rawLine in query.Output.Split('\n'))
            {
                string line = rawLine.Trim();
                if (line.Length == 0) continue;

                string[] parts = Regex.Split(line, @"\s+");
                if (parts.Length < 2) continue;
                if (!string.Equals(parts[0], _element, StringComparison.OrdinalIgnoreCase)) continue;

                return new CapturedValue(
                    _element,
                    "",
                    string.Join(" ", parts, 1, parts.Length - 1).Trim(),
                    true
                );
            }

            return new CapturedValue(_element, "", "", false);
        }
    }

    /// <summary>
    /// Compares BCD boolean values across the spellings the store uses, falling back to a plain
    /// comparison for the non-boolean elements (numbers, GUIDs, paths).
    /// </summary>
    public static class BcdBoolean
    {
        // Only the spellings bcdedit and the BCD store actually produce. Translated tokens were
        // tried here first and removed: a pt-BR Windows prints "Yes", so they guarded nothing and
        // would have quietly accepted a word the store never emits.
        private static readonly HashSet<string> True = new(StringComparer.OrdinalIgnoreCase)
        {
            "yes", "true", "on", "1",
        };

        private static readonly HashSet<string> False = new(StringComparer.OrdinalIgnoreCase)
        {
            "no", "false", "off", "0",
        };

        public static bool SameValue(string actual, string desired)
        {
            string left = actual.Trim();
            string right = desired.Trim();

            if (True.Contains(right)) return True.Contains(left);
            if (False.Contains(right)) return False.Contains(left);
            return string.Equals(left, right, StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>Maps a printed (possibly localized) boolean back to the token bcdedit accepts.</summary>
        public static string ToCommandToken(string printed)
        {
            string value = printed.Trim();
            if (True.Contains(value)) return "yes";
            if (False.Contains(value)) return "no";
            return value;
        }
    }
}
