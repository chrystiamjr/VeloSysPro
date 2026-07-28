using System.Linq;
using Xunit;

namespace VeloSysPro.Tests;

public class PowerPlanTweakTests
{
    private const string Balanced = "381b4222-f694-41f0-9685-ff5bb260df2e";
    private const string High = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c";
    private const string Saver = "a1841308-3541-4fab-bc81-f71556f20b4a";
    private const string Ultimate = "e9a42b02-d5df-448d-aa00-03f14749eb61";

    /// <summary>
    /// What <c>powercfg /getactivescheme</c> really prints on the pt-BR machine this was verified
    /// against on 2026-07-27. Only the GUID is stable; the label and the sentence around it are not.
    /// </summary>
    private static string ActiveScheme(string guid, string label) =>
        "GUID do Esquema de Energia: " + guid + "  (" + label + ")";

    private static string ActiveSchemeEnglish(string guid, string label) =>
        "Power Scheme GUID: " + guid + "  (" + label + ")";

    /// <summary>The real pt-BR <c>powercfg /list</c>, with the active scheme starred.</summary>
    private static string SchemeList(params string[] guids) =>
        "\r\nEsquemas de Energia Existentes (* Ativos)\r\n-----------------------------------\r\n"
        + string.Join(
            "\r\n",
            guids.Select(guid => "GUID do Esquema de Energia: " + guid + "  (Um nome)")
        )
        + "\r\n";

    private static PowerPlanTweak Tweak(ICommandRunner cmd) =>
        new("system.powerPlan", TweakCategories.System, RiskTier.Safe, cmd);

    [Fact]
    public void Detect_ReadsTheActiveSchemeGuidWhateverTheWindowsLanguageIs()
    {
        var runner = new FakeCommandRunner { CapturedOutput = ActiveScheme(High, "Alto desempenho") };

        Assert.Equal(TweakState.Applied, Tweak(runner).Detect());

        var (exe, args) = Assert.Single(runner.Runs);
        Assert.Equal("powercfg.exe", exe);
        Assert.Equal("/getactivescheme", args);
    }

    [Fact]
    public void Detect_ReadsAnEnglishMachineTheSameWay()
    {
        var runner = new FakeCommandRunner
        {
            CapturedOutput = ActiveSchemeEnglish(High, "High performance"),
        };

        Assert.Equal(TweakState.Applied, Tweak(runner).Detect());
    }

    [Fact]
    public void Detect_AcceptsUltimatePerformanceAsAlreadySatisfyingTheTweak()
    {
        // Ultimate is strictly less power-saving than High, so a machine already on it wants
        // nothing done: reporting NotApplied would offer to "optimize" it down a rung
        // (.agents/rules/detect-intent-not-equality.md).
        var runner = new FakeCommandRunner
        {
            CapturedOutput = ActiveScheme(Ultimate, "Desempenho Máximo"),
        };

        Assert.Equal(TweakState.Applied, Tweak(runner).Detect());
    }

    [Theory]
    [InlineData(Balanced)]
    [InlineData(Saver)]
    public void Detect_ReportsNotAppliedForAPowerSavingScheme(string guid)
    {
        var runner = new FakeCommandRunner { CapturedOutput = ActiveScheme(guid, "Equilibrado") };

        Assert.Equal(TweakState.NotApplied, Tweak(runner).Detect());
    }

    [Fact]
    public void Detect_ReportsNotAppliedWhenPowercfgFails()
    {
        var runner = new FakeCommandRunner { Result = new CommandResult(1, false) };

        Assert.Equal(TweakState.NotApplied, Tweak(runner).Detect());
    }

    [Fact]
    public void Capture_RecordsTheExactSchemeGuidThatWasActive()
    {
        var runner = new FakeCommandRunner { CapturedOutput = ActiveScheme(Balanced, "Equilibrado") };

        CapturedValue value = Assert.Single(Tweak(runner).Capture().Values);

        Assert.True(value.Existed);
        Assert.Equal("ActiveScheme", value.Name);
        Assert.Equal(Balanced, value.Data);
    }

    [Fact]
    public void Capture_MarksTheSchemeUnreadableRatherThanInventingOne()
    {
        var runner = new FakeCommandRunner { Result = new CommandResult(1, false) };

        Assert.False(Assert.Single(Tweak(runner).Capture().Values).Existed);
    }

    [Fact]
    public void Apply_ActivatesUltimatePerformanceWhenTheMachineOffersIt()
    {
        var runner = new ScriptedCommandRunner();
        runner.EnqueueCapture(SchemeList(Balanced, High, Saver, Ultimate));
        var tweak = Tweak(runner);

        Assert.True(tweak.Apply(Capture(Balanced)));

        Assert.Equal("/setactive " + Ultimate, runner.Runs.Last().Args);
    }

    [Fact]
    public void Apply_FallsBackToHighPerformanceWhenUltimateIsNotInstalled()
    {
        // The verified machine has exactly these three: Ultimate ships hidden and is absent on most
        // consumer installs, so the fallback is the normal path rather than the edge case.
        var runner = new ScriptedCommandRunner();
        runner.EnqueueCapture(SchemeList(Balanced, High, Saver));
        var tweak = Tweak(runner);

        Assert.True(tweak.Apply(Capture(Balanced)));

        Assert.Equal("/setactive " + High, runner.Runs.Last().Args);
    }

    [Fact]
    public void Apply_FailsWithoutTouchingAnythingWhenNoEligibleSchemeExists()
    {
        var runner = new ScriptedCommandRunner();
        runner.EnqueueCapture(SchemeList(Balanced, Saver));
        var tweak = Tweak(runner);

        Assert.False(tweak.Apply(Capture(Balanced)));

        Assert.DoesNotContain(runner.Runs, run => run.Args.StartsWith("/setactive"));
    }

    [Theory]
    [InlineData(Ultimate)]
    [InlineData(High)]
    public void Apply_LeavesAMachineAlreadyOnAnEligibleSchemeAlone(string active)
    {
        // Idempotence and the no-downgrade rule are the same assertion here: applying again must
        // issue no command, and a machine on Ultimate must never be moved to High
        // (.agents/rules/detect-intent-not-equality.md, requirement 3).
        var runner = new ScriptedCommandRunner();

        Assert.True(Tweak(runner).Apply(Capture(active)));

        Assert.Empty(runner.Runs);
    }

    [Fact]
    public void Apply_RefusesACaptureThatNeverReadTheScheme()
    {
        // Revert refuses this capture, so applying would move the machine with no way back. That
        // asymmetry — mutate on an unreadable capture, then refuse to undo it — is the one thing a
        // reversible Tweak may never do.
        var runner = new ScriptedCommandRunner();
        runner.EnqueueCapture(SchemeList(Balanced, High, Saver));
        var tweak = Tweak(runner);
        var capture = new TweakCapture(
            tweak.Id,
            TweakKinds.Power,
            "",
            new[] { new CapturedValue("ActiveScheme", "", "", false) }
        );

        Assert.False(tweak.Apply(capture));

        Assert.DoesNotContain(runner.Runs, run => run.Args.StartsWith("/setactive"));
    }

    [Fact]
    public void Revert_ReactivatesTheExactCapturedScheme()
    {
        var runner = new FakeCommandRunner();
        var tweak = Tweak(runner);

        Assert.True(tweak.Revert(Capture(Balanced)));

        var (exe, args) = Assert.Single(runner.Runs);
        Assert.Equal("powercfg.exe", exe);
        Assert.Equal("/setactive " + Balanced, args);
    }

    [Fact]
    public void Revert_RefusesACaptureThatNeverReadTheScheme()
    {
        var runner = new FakeCommandRunner();
        var tweak = Tweak(runner);
        var capture = new TweakCapture(
            tweak.Id,
            TweakKinds.Power,
            "",
            new[] { new CapturedValue("ActiveScheme", "", "", false) }
        );

        Assert.False(tweak.Revert(capture));
        Assert.Empty(runner.Runs);
    }

    [Fact]
    public void Revert_RefusesACaptureWhoseSchemeCouldInjectCommandArguments()
    {
        var runner = new FakeCommandRunner();
        var tweak = Tweak(runner);
        var capture = new TweakCapture(
            tweak.Id,
            TweakKinds.Power,
            "",
            new[] { new CapturedValue("ActiveScheme", "", Balanced + " & calc", true) }
        );

        Assert.False(tweak.Revert(capture));
        Assert.Empty(runner.Runs);
    }

    [Fact]
    public void RoundTrip_PutsThePriorSchemeBack()
    {
        var runner = new ScriptedCommandRunner();
        runner.EnqueueCapture(ActiveScheme(Balanced, "Equilibrado")); // capture
        runner.EnqueueCapture(SchemeList(Balanced, High, Saver)); // apply enumerates
        var tweak = Tweak(runner);

        TweakCapture capture = tweak.Capture();
        Assert.True(tweak.Apply(capture));
        Assert.Equal("/setactive " + High, runner.Runs.Last().Args);

        Assert.True(tweak.Revert(capture));
        Assert.Equal("/setactive " + Balanced, runner.Runs.Last().Args);
    }

    private static TweakCapture Capture(string guid) =>
        new(
            "system.powerPlan",
            TweakKinds.Power,
            "",
            new[] { new CapturedValue("ActiveScheme", "", guid, true) }
        );
}
