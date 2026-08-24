using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;

namespace VeloSysPro.Tests;

/// <summary>
/// The allow-list is the removal security boundary, so these tests compare the whole approved set
/// rather than sampling it, and probe the near-misses an attacker or a typo would produce.
/// </summary>
public class DebloatCatalogTests
{
    /// <summary>
    /// The confirmed set from `.local/grills/2026-07-25/research-catalog.md` section F, written out
    /// here so the catalog is compared against the research rather than against itself.
    /// </summary>
    private static readonly string[] ApprovedSafePackages =
    {
        "MicrosoftCorporationII.QuickAssist",
        "Microsoft.WindowsFeedbackHub",
        "Microsoft.Copilot",
        "Microsoft.BingWeather",
        "MicrosoftCorporationII.MicrosoftFamily",
        "Microsoft.MicrosoftOfficeHub",
        "Microsoft.BingSearch",
        "Clipchamp.Clipchamp",
        "Microsoft.BingNews",
        "Microsoft.OutlookForWindows",
        "Microsoft.WindowsAlarms",
        "Microsoft.MicrosoftSolitaireCollection",
    };

    private static readonly string[] ApprovedOptionalPackages =
    {
        "Microsoft.WindowsCamera",
        "Microsoft.WindowsSoundRecorder",
        "Microsoft.ScreenSketch",
        "Microsoft.PowerAutomateDesktop",
        "Microsoft.Xbox.TCUI",
        "Microsoft.GamingApp",
    };

    private static IEnumerable<string> PackagesOf(DebloatGroup group) =>
        DebloatCatalog
            .CreateDefault()
            .Entries.Where(entry => entry.Group == group)
            .SelectMany(entry => entry.Packages);

    [Fact]
    public void SafeGroupIsExactlyTheConfirmedResearchSet()
    {
        Assert.Equal(
            ApprovedSafePackages.OrderBy(name => name, StringComparer.Ordinal),
            PackagesOf(DebloatGroup.Safe).OrderBy(name => name, StringComparer.Ordinal)
        );
    }

    [Fact]
    public void OptionalGroupIsExactlyTheConfirmedResearchSet()
    {
        Assert.Equal(
            ApprovedOptionalPackages.OrderBy(name => name, StringComparer.Ordinal),
            PackagesOf(DebloatGroup.Optional).OrderBy(name => name, StringComparer.Ordinal)
        );
    }

    [Fact]
    public void EveryApprovedPackageAppearsExactlyOnce()
    {
        List<string> all = DebloatCatalog
            .CreateDefault()
            .Entries.SelectMany(entry => entry.Packages)
            .ToList();

        Assert.Equal(all.Count, all.Distinct(StringComparer.Ordinal).Count());
    }

    [Fact]
    public void OneDriveIsOptionalAndRemovedThroughItsOwnUninstaller()
    {
        DebloatEntry? oneDrive = DebloatCatalog.CreateDefault().Find("oneDrive");

        Assert.NotNull(oneDrive);
        Assert.Equal(DebloatGroup.Optional, oneDrive!.Group);
        Assert.Equal(DebloatRemoval.OneDriveUninstaller, oneDrive.Removal);
        // It is not an Appx package, so nothing may reach Remove-AppxPackage on its behalf.
        Assert.Empty(oneDrive.Packages);
    }

    [Fact]
    public void XboxTargetsOnlyTheTwoDeclaredPackages()
    {
        DebloatEntry? xbox = DebloatCatalog.CreateDefault().Find("xbox");

        Assert.NotNull(xbox);
        Assert.Equal(
            new[] { "Microsoft.GamingApp", "Microsoft.Xbox.TCUI" },
            xbox!.Packages.OrderBy(name => name, StringComparer.Ordinal)
        );
    }

    [Theory]
    // An arbitrary package that was never approved.
    [InlineData("Microsoft.WindowsStore")]
    // Prefix- and suffix-similar near-misses of an approved entry.
    [InlineData("weatherApp")]
    [InlineData("weathe")]
    [InlineData("Weather")]
    [InlineData("Microsoft.BingWeather")]
    // Wildcards, which is how a broad substring removal would be smuggled in.
    [InlineData("*")]
    [InlineData("weather*")]
    [InlineData("*.Bing*")]
    // Structurally malformed ids.
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("weather;calc")]
    public void RejectsAnythingThatIsNotAnExactCatalogId(string id)
    {
        Assert.Null(DebloatCatalog.CreateDefault().Find(id));
    }

    [Fact]
    public void FindMatchesTheCatalogIdExactly()
    {
        Assert.NotNull(DebloatCatalog.CreateDefault().Find("weather"));
    }

    [Fact]
    public void EveryEntryCarriesAUniqueId()
    {
        List<string> ids = DebloatCatalog.CreateDefault().Entries.Select(entry => entry.Id).ToList();

        Assert.Equal(ids.Count, ids.Distinct(StringComparer.Ordinal).Count());
    }

    [Fact]
    public void RefusesToConstructWithAWildcardPackageName()
    {
        // The catalog is written by hand, so this guard protects the one mistake that would turn a
        // curated list into a broad removal: a wildcard slipping into an entry.
        Assert.Throws<ArgumentException>(() =>
            new DebloatCatalog(
                new[]
                {
                    new DebloatEntry("news", DebloatGroup.Safe, new[] { "Microsoft.Bing*" }, DebloatRemoval.Appx),
                }
            )
        );
    }

    [Fact]
    public void RefusesToConstructAnAppxEntryWithNoPackages()
    {
        Assert.Throws<ArgumentException>(() =>
            new DebloatCatalog(
                new[] { new DebloatEntry("news", DebloatGroup.Safe, Array.Empty<string>(), DebloatRemoval.Appx) }
            )
        );
    }

    [Fact]
    public void RefusesToConstructWithDuplicateIds()
    {
        Assert.Throws<ArgumentException>(() =>
            new DebloatCatalog(
                new[]
                {
                    new DebloatEntry("news", DebloatGroup.Safe, new[] { "Microsoft.BingNews" }, DebloatRemoval.Appx),
                    new DebloatEntry("news", DebloatGroup.Optional, new[] { "Microsoft.BingWeather" }, DebloatRemoval.Appx),
                }
            )
        );
    }

    [Fact]
    public void EveryIdIsUsableAsAnI18nPathSegment()
    {
        // The frontend builds `debloat.package.<id>.title` and rosetta splits that on dots, so a
        // dotted id would look up a nesting level the locale files do not have.
        foreach (DebloatEntry entry in DebloatCatalog.CreateDefault().Entries)
            Assert.Matches("^[a-z][A-Za-z0-9]*$", entry.Id);
    }
}
