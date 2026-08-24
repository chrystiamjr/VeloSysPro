using System.Collections.Generic;
using System.Linq;
using Xunit;

namespace VeloSysPro.Tests;

/// <summary>
/// The seam that produces <see cref="TweakState.Unsupported"/>: the capability probe, and the
/// decorator that turns its answer into a state and a refusal.
/// </summary>
public class SupportGatedTweakTests
{
    private sealed class StubTweak : ITweak
    {
        public string Id => "windows.recall";
        public string Category => TweakCategories.Windows;
        public RiskTier RiskTier => RiskTier.Safe;
        public string Kind => TweakKinds.Registry;
        public bool RequiresReboot => false;
        public List<string> Calls { get; } = new();

        public TweakState Detect()
        {
            Calls.Add("detect");
            return TweakState.Applied;
        }

        public IReadOnlyList<CapturedValue> ReadCurrentValues() => new CapturedValue[0];

        public TweakCapture Capture() => new(Id, Kind, "", ReadCurrentValues());

        public bool Apply(TweakCapture capture)
        {
            Calls.Add("apply");
            return true;
        }

        public bool Revert(TweakCapture capture)
        {
            Calls.Add("revert");
            return true;
        }
    }

    [Fact]
    public void Detect_ReportsUnsupportedWithoutEvenAskingTheTweak()
    {
        // Asking the inner Tweak would read a registry value whose absence says nothing on a
        // machine that has never had the feature — the confusion this decorator exists to remove.
        var inner = new StubTweak();
        var gated = new SupportGatedTweak(inner, () => false);

        Assert.Equal(TweakState.Unsupported, gated.Detect());
        Assert.Empty(inner.Calls);
    }

    [Fact]
    public void Detect_DefersToTheTweakOnAMachineThatHasTheFeature()
    {
        var inner = new StubTweak();

        Assert.Equal(TweakState.Applied, new SupportGatedTweak(inner, () => true).Detect());
        Assert.Equal(new[] { "detect" }, inner.Calls);
    }

    [Fact]
    public void Apply_RefusesWithoutAskingTheTweakButRevertStillRuns()
    {
        // The refusal guards writing, never restoring: a capture exists only because the Tweak was
        // applied while the feature was there.
        var inner = new StubTweak();
        var gated = new SupportGatedTweak(inner, () => false);
        var capture = new TweakCapture(inner.Id, inner.Kind, "", new CapturedValue[0]);

        Assert.False(gated.Apply(capture));
        Assert.True(gated.Revert(capture));
        Assert.Equal(new[] { "revert" }, inner.Calls);
    }

    [Fact]
    public void Detect_ReadsSupportLiveSoAMachineThatGainsTheFeatureStartsReporting()
    {
        // Nothing is stored: the catalog is built once at startup and detection runs on every
        // refresh, so the answer must not be frozen into the decorator.
        bool supported = false;
        var gated = new SupportGatedTweak(new StubTweak(), () => supported);

        Assert.Equal(TweakState.Unsupported, gated.Detect());
        supported = true;
        Assert.Equal(TweakState.Applied, gated.Detect());
    }

    [Fact]
    public void Exists_AsksTheOptionalFeatureListWithoutTouchingTheRegistry()
    {
        var runner = new ScriptedCommandRunner();
        runner.EnqueueCapture("present\r\n");

        Assert.True(new WindowsOptionalFeatures(runner).Exists("Recall"));

        (string Exe, string Args) probe = Assert.Single(runner.Runs);
        Assert.Equal("powershell.exe", probe.Exe);
        Assert.Contains("Win32_OptionalFeature", probe.Args);
        Assert.Contains("'Recall'", probe.Args);
        Assert.DoesNotContain("reg.exe", probe.Args);
    }

    [Fact]
    public void Exists_ReportsAbsentForAFeatureTheImageDoesNotList()
    {
        var runner = new ScriptedCommandRunner();
        runner.EnqueueCapture("absent\r\n");

        Assert.False(new WindowsOptionalFeatures(runner).Exists("Recall"));
    }

    [Fact]
    public void Exists_TreatsAQueryThatNeverRanAsNoAnswerRatherThanAsPresent()
    {
        // Verified on a real machine on 2026-08-23: the same query answers "present" for
        // TelnetClient and "absent" for Recall, so a failure here is a broken probe, not a machine
        // without the feature — and offering to write a policy on the strength of it would be the
        // "reports success while changing nothing" failure in a new place.
        var runner = new ScriptedCommandRunner();
        runner.EnqueueFailedCapture();

        Assert.False(new WindowsOptionalFeatures(runner).Exists("Recall"));
    }

    [Fact]
    public void Exists_AsksWindowsOncePerFeatureRatherThanOncePerDetect()
    {
        // Detection runs for every Tweak on every refresh of the screen; the round trip is a
        // PowerShell start plus a WMI query, measured at roughly two seconds.
        var runner = new ScriptedCommandRunner();
        runner.EnqueueCapture("present\r\n");
        var features = new WindowsOptionalFeatures(runner);

        Assert.True(features.Exists("Recall"));
        Assert.True(features.Exists("Recall"));

        Assert.Single(runner.Runs);
    }

    [Fact]
    public void Exists_RefusesAFeatureNameThatCouldCloseTheQuoteItIsInterpolatedInto()
    {
        var runner = new ScriptedCommandRunner();

        Assert.False(new WindowsOptionalFeatures(runner).Exists("Recall'; Remove-Item C:\\ #"));
        Assert.Empty(runner.Runs);
    }

    [Fact]
    public void Exists_ReadsOnlyTheTokenItPrintsItselfAndNothingWindowsTranslates()
    {
        // The machine this was written on runs a pt-BR Windows. Any answer parsed out of text
        // Windows chose would have been read wrong there.
        var runner = new ScriptedCommandRunner();
        runner.EnqueueCapture("Recurso presente\r\n");

        Assert.False(new WindowsOptionalFeatures(runner).Exists("Recall"));
        Assert.DoesNotContain(runner.Runs, run => run.Args.Contains("Format-Table"));
    }
}
