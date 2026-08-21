using System;
using System.Reflection;
using System.Text.RegularExpressions;

namespace VeloSysPro
{
    /// <summary>
    /// Value object representing a Semantic Version 2.0.0 compliant version tag with
    /// comparison, pre-release support, and assembly extraction.
    /// </summary>
    public sealed record SemanticVersion : IComparable<SemanticVersion>, IComparable
    {
        private static readonly Regex SemVerPattern = new(
            @"^v?(?<major>\d+)\.(?<minor>\d+)(?:\.(?<patch>\d+))?(?:-(?<prerelease>[0-9A-Za-z.-]+))?(?:\+(?<build>[0-9A-Za-z.-]+))?$",
            RegexOptions.Compiled | RegexOptions.IgnoreCase
        );

        public int Major { get; }
        public int Minor { get; }
        public int Patch { get; }
        public string PreRelease { get; }
        public string BuildMetadata { get; }

        public SemanticVersion(int major, int minor, int patch = 0, string prerelease = "", string build = "")
        {
            Major = major;
            Minor = minor;
            Patch = patch;
            PreRelease = prerelease ?? "";
            BuildMetadata = build ?? "";
        }

        public static bool TryParse(string? raw, out SemanticVersion? version)
        {
            version = null;
            if (string.IsNullOrWhiteSpace(raw)) return false;

            Match match = SemVerPattern.Match(raw.Trim());
            if (!match.Success) return false;

            int major = int.Parse(match.Groups["major"].Value);
            int minor = int.Parse(match.Groups["minor"].Value);
            int patch = match.Groups["patch"].Success ? int.Parse(match.Groups["patch"].Value) : 0;
            string prerelease = match.Groups["prerelease"].Success ? match.Groups["prerelease"].Value : "";
            string build = match.Groups["build"].Success ? match.Groups["build"].Value : "";

            version = new SemanticVersion(major, minor, patch, prerelease, build);
            return true;
        }

        public static SemanticVersion Parse(string raw) =>
            TryParse(raw, out SemanticVersion? version)
                ? version!
                : throw new FormatException($"Invalid Semantic Version: '{raw}'");

        public static SemanticVersion FromAssembly(Assembly? assembly = null)
        {
            Assembly target = assembly ?? Assembly.GetEntryAssembly() ?? Assembly.GetExecutingAssembly();
            var infoAttr = target.GetCustomAttribute<AssemblyInformationalVersionAttribute>();
            if (infoAttr != null && TryParse(infoAttr.InformationalVersion.Split('+')[0], out var infoVer))
            {
                return infoVer!;
            }

            Version? asmVer = target.GetName().Version;
            if (asmVer != null)
            {
                return new SemanticVersion(asmVer.Major, asmVer.Minor, Math.Max(0, asmVer.Build));
            }

            return new SemanticVersion(1, 0, 0);
        }

        public override string ToString()
        {
            string baseVer = $"{Major}.{Minor}.{Patch}";
            if (!string.IsNullOrEmpty(PreRelease)) baseVer += $"-{PreRelease}";
            if (!string.IsNullOrEmpty(BuildMetadata)) baseVer += $"+{BuildMetadata}";
            return baseVer;
        }

        public int CompareTo(SemanticVersion? other)
        {
            if (ReferenceEquals(this, other)) return 0;
            if (other is null) return 1;

            int majorCmp = Major.CompareTo(other.Major);
            if (majorCmp != 0) return majorCmp;

            int minorCmp = Minor.CompareTo(other.Minor);
            if (minorCmp != 0) return minorCmp;

            int patchCmp = Patch.CompareTo(other.Patch);
            if (patchCmp != 0) return patchCmp;

            // SemVer rule: release > prerelease
            bool thisHasPre = !string.IsNullOrEmpty(PreRelease);
            bool otherHasPre = !string.IsNullOrEmpty(other.PreRelease);

            if (!thisHasPre && otherHasPre) return 1;
            if (thisHasPre && !otherHasPre) return -1;
            if (!thisHasPre && !otherHasPre) return 0;

            return string.Compare(PreRelease, other.PreRelease, StringComparison.OrdinalIgnoreCase);
        }

        public int CompareTo(object? obj) => CompareTo(obj as SemanticVersion);

        public static bool operator >(SemanticVersion? left, SemanticVersion? right) =>
            left is not null && (right is null || left.CompareTo(right) > 0);

        public static bool operator <(SemanticVersion? left, SemanticVersion? right) =>
            left is null ? right is not null : left.CompareTo(right) < 0;

        public static bool operator >=(SemanticVersion? left, SemanticVersion? right) =>
            left is null ? right is null : left.CompareTo(right) >= 0;

        public static bool operator <=(SemanticVersion? left, SemanticVersion? right) =>
            left is null || left.CompareTo(right) <= 0;
    }
}
