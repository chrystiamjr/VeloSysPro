using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace VeloSysPro
{
    /// <summary>
    /// How much the app stands behind removing an entry.
    /// </summary>
    /// <remarks>
    /// <c>Safe</c> is the confirmed research set: preinstalled apps that nothing else depends on.
    /// <c>Optional</c> is for apps a person may genuinely be using, so the UI leaves them unticked
    /// and never selects one on the user's behalf.
    /// </remarks>
    public enum DebloatGroup
    {
        Safe,
        Optional,
    }

    /// <summary>How an entry is uninstalled — which also decides how it comes back.</summary>
    public enum DebloatRemoval
    {
        /// <summary>A Store package: removed with Remove-AppxPackage, reinstalled from the Store.</summary>
        Appx,

        /// <summary>OneDrive: removed by the setup binary Microsoft ships with it.</summary>
        OneDriveUninstaller,
    }

    /// <summary>
    /// One removable thing, named by an id of this app's own making rather than by a package name.
    /// </summary>
    /// <remarks>
    /// The split is the security boundary. <paramref name="Id"/> is what crosses IPC; the package
    /// names in <paramref name="Packages"/> only ever come from this file, so no string the
    /// frontend sends can reach a removal command — the worst a malformed payload can do is fail
    /// to match an id. It also keeps the id usable as an i18n path segment, which a dotted package
    /// name is not.
    /// </remarks>
    public sealed record DebloatEntry(
        string Id,
        DebloatGroup Group,
        IReadOnlyList<string> Packages,
        DebloatRemoval Removal
    )
    {
        /// <summary>The invariant token the frontend translates into the reinstall caveat.</summary>
        public string Caveat => Removal == DebloatRemoval.Appx ? "store" : "oneDrive";
    }

    /// <summary>
    /// The allow-list of everything VeloSys Pro will uninstall.
    /// </summary>
    /// <remarks>
    /// Debloat is not a Tweak: a removed app cannot be put back by this app, only reinstalled from
    /// the Store. That is why this is an allow-list rather than a ban-list, why it is compared in
    /// full against the research catalog by a test, and why nothing here is derived from anything
    /// the user or the system said.
    /// </remarks>
    public sealed class DebloatCatalog
    {
        /// <summary>
        /// Appx family names are alphanumerics with dots, dashes and underscores — deliberately no
        /// wildcard, no space, no separator a shell could act on.
        /// </summary>
        private static readonly Regex PackageNamePattern =
            new("^[A-Za-z0-9][A-Za-z0-9._-]*$", RegexOptions.Compiled);

        private static readonly Regex IdPattern = new("^[a-z][A-Za-z0-9]*$", RegexOptions.Compiled);

        private readonly Dictionary<string, DebloatEntry> _byId;

        public DebloatCatalog(IReadOnlyList<DebloatEntry> entries)
        {
            _byId = new Dictionary<string, DebloatEntry>(StringComparer.Ordinal);

            foreach (DebloatEntry entry in entries)
            {
                if (!IdPattern.IsMatch(entry.Id))
                    throw new ArgumentException("Debloat id is not a usable i18n segment: " + entry.Id);

                if (!_byId.TryAdd(entry.Id, entry))
                    throw new ArgumentException("Duplicate Debloat id: " + entry.Id);

                if (entry.Removal == DebloatRemoval.Appx && entry.Packages.Count == 0)
                    throw new ArgumentException("Appx entry names no package: " + entry.Id);

                if (entry.Removal != DebloatRemoval.Appx && entry.Packages.Count > 0)
                    throw new ArgumentException(
                        "Entry '" + entry.Id + "' is not an Appx removal but names packages."
                    );

                foreach (string package in entry.Packages)
                {
                    if (!PackageNamePattern.IsMatch(package))
                        throw new ArgumentException(
                            "Entry '" + entry.Id + "' names an unusable package: " + package
                        );
                }
            }

            Entries = entries;
        }

        public IReadOnlyList<DebloatEntry> Entries { get; }

        /// <summary>
        /// The entry with exactly this id, or null.
        /// </summary>
        /// <remarks>
        /// Ordinal and exact on purpose: case-insensitive or prefix matching is how a near-miss id
        /// would end up removing something nobody selected.
        /// </remarks>
        public DebloatEntry? Find(string id) =>
            _byId.TryGetValue(id, out DebloatEntry? entry) ? entry : null;

        /// <summary>
        /// The shipped allow-list, transcribed from the confirmed research set in
        /// `.local/grills/2026-07-25/research-catalog.md` section F.
        /// </summary>
        public static DebloatCatalog CreateDefault() =>
            new(
                new[]
                {
                    Appx("quickAssist", DebloatGroup.Safe, "MicrosoftCorporationII.QuickAssist"),
                    Appx("feedbackHub", DebloatGroup.Safe, "Microsoft.WindowsFeedbackHub"),
                    Appx("copilot", DebloatGroup.Safe, "Microsoft.Copilot"),
                    Appx("weather", DebloatGroup.Safe, "Microsoft.BingWeather"),
                    Appx("family", DebloatGroup.Safe, "MicrosoftCorporationII.MicrosoftFamily"),
                    Appx("officeHub", DebloatGroup.Safe, "Microsoft.MicrosoftOfficeHub"),
                    Appx("bingSearch", DebloatGroup.Safe, "Microsoft.BingSearch"),
                    Appx("clipchamp", DebloatGroup.Safe, "Clipchamp.Clipchamp"),
                    Appx("news", DebloatGroup.Safe, "Microsoft.BingNews"),
                    Appx("outlook", DebloatGroup.Safe, "Microsoft.OutlookForWindows"),
                    Appx("alarms", DebloatGroup.Safe, "Microsoft.WindowsAlarms"),
                    Appx("solitaire", DebloatGroup.Safe, "Microsoft.MicrosoftSolitaireCollection"),
                    Appx("camera", DebloatGroup.Optional, "Microsoft.WindowsCamera"),
                    Appx("soundRecorder", DebloatGroup.Optional, "Microsoft.WindowsSoundRecorder"),
                    Appx("screenSketch", DebloatGroup.Optional, "Microsoft.ScreenSketch"),
                    Appx("powerAutomate", DebloatGroup.Optional, "Microsoft.PowerAutomateDesktop"),
                    // One row rather than two: the console app and its overlay are one decision to
                    // the user, and splitting them would let someone remove half of Xbox.
                    Appx(
                        "xbox",
                        DebloatGroup.Optional,
                        "Microsoft.GamingApp",
                        "Microsoft.Xbox.TCUI"
                    ),
                    // Not an Appx package at all, which is why it needs its own removal path.
                    new DebloatEntry(
                        "oneDrive",
                        DebloatGroup.Optional,
                        Array.Empty<string>(),
                        DebloatRemoval.OneDriveUninstaller
                    ),
                }
            );

        private static DebloatEntry Appx(string id, DebloatGroup group, params string[] packages) =>
            new(id, group, packages, DebloatRemoval.Appx);
    }
}
