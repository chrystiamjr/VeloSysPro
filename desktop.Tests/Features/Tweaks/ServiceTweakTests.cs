using System.Linq;
using Xunit;

namespace VeloSysPro.Tests;

public class ServiceTweakTests
{
    private static ServiceTweak Tweak(ICommandRunner runner) =>
        new("services.sysMain", TweakCategories.Services, RiskTier.Safe, "SysMain", "Manual", runner);

    [Fact]
    public void Detect_ReadsTheStartTypeAsALocaleNeutralEnumString()
    {
        var runner = new FakeCommandRunner { CapturedOutput = "Manual\r\n" };

        Assert.Equal(TweakState.Applied, Tweak(runner).Detect());

        var (exe, args) = Assert.Single(runner.Runs);
        Assert.Equal("powershell.exe", exe);
        Assert.Contains("Get-Service -Name 'SysMain'", args);
        // Without the [string] cast PowerShell would render the enum in the display language.
        Assert.Contains("[string]$_.StartType", args);
        Assert.Contains("-ErrorAction SilentlyContinue", args);
        Assert.Equal(0, args.Count(character => character == '"') % 2);
    }

    [Fact]
    public void Detect_ReportsNotAppliedWhenTheServiceStillStartsAutomatically()
    {
        var runner = new FakeCommandRunner { CapturedOutput = "Automatic\r\n" };

        Assert.Equal(TweakState.NotApplied, Tweak(runner).Detect());
    }

    [Theory]
    [InlineData("Disabled")] // quieter than Manual: the goal is already met, and then some
    [InlineData("Manual")]
    public void Detect_CountsAStartTypeAtLeastAsQuietAsTheGoal(string startType)
    {
        // Found on a real machine: SysMain was already Disabled, and treating that as "not
        // applied" made the app change it to Manual — letting the service back in, reported as
        // an optimization.
        var runner = new FakeCommandRunner { CapturedOutput = startType + "\r\n" };

        Assert.Equal(TweakState.Applied, Tweak(runner).Detect());
    }

    [Theory]
    [InlineData("Boot")]
    [InlineData("System")]
    [InlineData("Automatic")]
    [InlineData("AutomaticDelayedStart")]
    public void Detect_ReportsNotAppliedForEveryStartTypeNoisierThanTheGoal(string startType)
    {
        var runner = new FakeCommandRunner { CapturedOutput = startType + "\r\n" };

        Assert.Equal(TweakState.NotApplied, Tweak(runner).Detect());
    }

    [Fact]
    public void Apply_LeavesAServiceThatIsAlreadyQuieterThanTheGoalAlone()
    {
        var runner = new FakeCommandRunner();
        var tweak = Tweak(runner);
        var capture = new TweakCapture(
            tweak.Id,
            TweakKinds.Service,
            "2026-07-25T10:00:00.0000000Z",
            new[] { new CapturedValue("StartType", "", "Disabled", true) }
        );

        Assert.True(tweak.Apply(capture));

        Assert.Empty(runner.Runs);
    }

    [Fact]
    public void Apply_ActsWhenTheServiceIsNoisierThanTheGoal()
    {
        var runner = new FakeCommandRunner();
        var tweak = Tweak(runner);
        var capture = new TweakCapture(
            tweak.Id,
            TweakKinds.Service,
            "2026-07-25T10:00:00.0000000Z",
            new[] { new CapturedValue("StartType", "", "Automatic", true) }
        );

        Assert.True(tweak.Apply(capture));

        Assert.Equal("config SysMain start= demand", Assert.Single(runner.Runs).Args);
    }

    [Theory]
    [InlineData(false)] // Get-Service never answered: no values at all
    [InlineData(true)] // it answered with a start type ServiceTweak does not recognize
    public void Apply_RefusesAServiceWhoseStartTypeCouldNotBeRead(bool hasUnreadValue)
    {
        // Revert already refuses a capture with no readable start type, so acting here would
        // reconfigure the service with nothing to put back. Apply used to go ahead and run
        // `sc config` anyway, which left a service changed and un-revertable.
        var runner = new FakeCommandRunner();
        var tweak = Tweak(runner);
        var capture = new TweakCapture(
            tweak.Id,
            TweakKinds.Service,
            "",
            hasUnreadValue
                ? new[] { new CapturedValue("StartType", "", "Unknown", false) }
                : new CapturedValue[0]
        );

        Assert.False(tweak.Apply(capture));
        Assert.Empty(runner.Runs);
    }

    [Fact]
    public void Detect_ReportsNotAppliedWhenTheServiceIsNotInstalled()
    {
        var runner = new FakeCommandRunner { CapturedOutput = "   \r\n" };

        Assert.Equal(TweakState.NotApplied, Tweak(runner).Detect());
    }

    [Fact]
    public void Capture_RecordsThePriorStartType()
    {
        var runner = new FakeCommandRunner { CapturedOutput = "Automatic\r\n" };

        TweakCapture capture = Tweak(runner).Capture();

        CapturedValue value = Assert.Single(capture.Values);
        Assert.Equal(TweakKinds.Service, capture.Kind);
        Assert.Equal("StartType", value.Name);
        Assert.True(value.Existed);
        Assert.Equal("Automatic", value.Data);
    }

    [Fact]
    public void Capture_FallsBackToUnknownForAStartTypeItDoesNotRecognize()
    {
        // Mirrors SchedulePolicy: an unrecognized OS state becomes Unknown rather than a guess,
        // and Revert refuses to act on it instead of picking an arbitrary start type.
        var runner = new FakeCommandRunner { CapturedOutput = "Automatique\r\n" };

        CapturedValue value = Assert.Single(Tweak(runner).Capture().Values);

        Assert.Equal("Unknown", value.Data);
        Assert.False(value.Existed);
    }

    [Fact]
    public void Apply_ConfiguresTheServiceWithTheScTokenForTheDesiredStartType()
    {
        var runner = new FakeCommandRunner();
        var tweak = Tweak(runner);
        var capture = new TweakCapture(
            tweak.Id,
            TweakKinds.Service,
            "",
            new[] { new CapturedValue("StartType", "", "Automatic", true) }
        );

        Assert.True(tweak.Apply(capture));

        var (exe, args) = Assert.Single(runner.Runs);
        Assert.Equal("sc.exe", exe);
        Assert.Equal("config SysMain start= demand", args);
    }

    [Theory]
    [InlineData("Automatic", "auto")]
    [InlineData("Manual", "demand")]
    [InlineData("Disabled", "disabled")]
    [InlineData("Boot", "boot")]
    [InlineData("System", "system")]
    public void Revert_RestoresTheExactPriorStartType(string captured, string scToken)
    {
        var runner = new FakeCommandRunner();
        var capture = new TweakCapture(
            "services.sysMain",
            TweakKinds.Service,
            "2026-07-25T10:00:00.0000000Z",
            new[] { new CapturedValue("StartType", "", captured, true) }
        );

        Assert.True(Tweak(runner).Revert(capture));

        var (exe, args) = Assert.Single(runner.Runs);
        Assert.Equal("sc.exe", exe);
        Assert.Equal("config SysMain start= " + scToken, args);
    }

    [Fact]
    public void Revert_RefusesToGuessWhenThePriorStartTypeWasNeverCaptured()
    {
        var runner = new FakeCommandRunner();
        var capture = new TweakCapture(
            "services.sysMain",
            TweakKinds.Service,
            "2026-07-25T10:00:00.0000000Z",
            new[] { new CapturedValue("StartType", "", "Unknown", false) }
        );

        Assert.False(Tweak(runner).Revert(capture));
        Assert.Empty(runner.Runs);
    }

    [Fact]
    public void RoundTrip_DetectsAppliedAfterApplyAndNotAppliedAfterRevert()
    {
        var runner = new ScriptedCommandRunner();
        runner.EnqueueCapture("Automatic\r\n"); // capture, before the change
        runner.EnqueueCapture("Manual\r\n"); // detect, after apply
        runner.EnqueueCapture("Automatic\r\n"); // detect, after revert
        var tweak = Tweak(runner);

        TweakCapture capture = tweak.Capture();
        Assert.True(tweak.Apply(capture));
        Assert.Equal(TweakState.Applied, tweak.Detect());
        Assert.True(tweak.Revert(capture));
        Assert.Equal(TweakState.NotApplied, tweak.Detect());

        Assert.Contains(runner.Runs, run => run.Args == "config SysMain start= demand");
        Assert.Contains(runner.Runs, run => run.Args == "config SysMain start= auto");
    }
}
