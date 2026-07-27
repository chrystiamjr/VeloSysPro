using Xunit;

namespace VeloSysPro.Tests;

public class BcdTweakTests
{
    private static BcdTweak Tweak(ICommandRunner runner) =>
        new("boot.disableDynamicTick", TweakCategories.Boot, RiskTier.Safe,
            "disabledynamictick", "yes", runner);

    private static string BootLoader(string trailingElements) =>
        "Windows Boot Loader\r\n"
        + "-------------------\r\n"
        + "identifier              {current}\r\n"
        + "device                  partition=C:\r\n"
        + "path                    \\WINDOWS\\system32\\winload.efi\r\n"
        + trailingElements;

    [Fact]
    public void Detect_EnumeratesTheCurrentBootEntryAndReportsApplied()
    {
        var runner = new FakeCommandRunner
        {
            CapturedOutput = BootLoader("disabledynamictick     Yes\r\n"),
        };

        Assert.Equal(TweakState.Applied, Tweak(runner).Detect());

        var (exe, args) = Assert.Single(runner.Runs);
        Assert.Equal("bcdedit.exe", exe);
        Assert.Equal("/enum {current}", args);
    }

    [Fact]
    public void Detect_ReportsNotAppliedWhenTheElementIsAbsentFromTheBcdStore()
    {
        var runner = new FakeCommandRunner { CapturedOutput = BootLoader("") };

        Assert.Equal(TweakState.NotApplied, Tweak(runner).Detect());
    }

    [Fact]
    public void Detect_ReportsNotAppliedWhenTheElementIsExplicitlyOff()
    {
        var runner = new FakeCommandRunner
        {
            CapturedOutput = BootLoader("disabledynamictick     No\r\n"),
        };

        Assert.Equal(TweakState.NotApplied, Tweak(runner).Detect());
    }

    [Theory]
    [InlineData("Sim")]
    [InlineData("Sí")]
    [InlineData("Ja")]
    [InlineData("Oui")]
    public void Detect_UnderstandsTheLocalizedBooleanBcdeditPrints(string affirmative)
    {
        // bcdedit renders boolean elements in the Windows display language, so a byte comparison
        // against "yes" would report the Tweak as not applied on a non-English machine.
        var runner = new FakeCommandRunner
        {
            CapturedOutput = BootLoader("disabledynamictick     " + affirmative + "\r\n"),
        };

        Assert.Equal(TweakState.Applied, Tweak(runner).Detect());
    }

    [Fact]
    public void Detect_ReportsNotAppliedWhenTheQueryItselfFails()
    {
        var runner = new FakeCommandRunner { Result = new CommandResult(1, false) };

        Assert.Equal(TweakState.NotApplied, Tweak(runner).Detect());
    }

    [Fact]
    public void Capture_RecordsThePriorElementValue()
    {
        var runner = new FakeCommandRunner
        {
            CapturedOutput = BootLoader("disabledynamictick     No\r\n"),
        };

        TweakCapture capture = Tweak(runner).Capture();

        CapturedValue value = Assert.Single(capture.Values);
        Assert.Equal(TweakKinds.Bcd, capture.Kind);
        Assert.Equal("disabledynamictick", value.Name);
        Assert.True(value.Existed);
        Assert.Equal("No", value.Data);
    }

    [Fact]
    public void Capture_MarksAnElementThatIsNotInTheStoreYet()
    {
        var runner = new FakeCommandRunner { CapturedOutput = BootLoader("") };

        CapturedValue value = Assert.Single(Tweak(runner).Capture().Values);

        Assert.False(value.Existed);
        Assert.Equal("", value.Data);
    }

    [Fact]
    public void Apply_SetsTheElementOnTheCurrentBootEntry()
    {
        var runner = new FakeCommandRunner();
        var tweak = Tweak(runner);

        Assert.True(tweak.Apply(tweak.Capture()));

        Assert.Contains(
            runner.Runs,
            run => run.Exe == "bcdedit.exe" && run.Args == "/set {current} disabledynamictick yes"
        );
    }

    [Theory]
    [InlineData("No")]
    // A pt-BR machine captures what bcdedit printed; bcdedit will not accept "Não" back, so the
    // restore has to be written in the canonical token.
    [InlineData("Não")]
    public void Revert_RestoresThePriorValueWhenTheElementExisted(string captured)
    {
        var runner = new FakeCommandRunner();
        var capture = new TweakCapture(
            "boot.disableDynamicTick",
            TweakKinds.Bcd,
            "2026-07-25T10:00:00.0000000Z",
            new[] { new CapturedValue("disabledynamictick", "", captured, true) }
        );

        Assert.True(Tweak(runner).Revert(capture));

        var (exe, args) = Assert.Single(runner.Runs);
        Assert.Equal("bcdedit.exe", exe);
        Assert.Equal("/set {current} disabledynamictick no", args);
    }

    [Fact]
    public void Revert_DeletesTheElementWhenItDidNotExistBefore()
    {
        var runner = new FakeCommandRunner();
        var capture = new TweakCapture(
            "boot.disableDynamicTick",
            TweakKinds.Bcd,
            "2026-07-25T10:00:00.0000000Z",
            new[] { new CapturedValue("disabledynamictick", "", "", false) }
        );

        Assert.True(Tweak(runner).Revert(capture));

        var (exe, args) = Assert.Single(runner.Runs);
        Assert.Equal("bcdedit.exe", exe);
        Assert.Equal("/deletevalue {current} disabledynamictick", args);
    }

    [Fact]
    public void Revert_RefusesACapturedValueThatCouldInjectCommandArguments()
    {
        var runner = new FakeCommandRunner();
        var capture = new TweakCapture(
            "boot.disableDynamicTick",
            TweakKinds.Bcd,
            "2026-07-25T10:00:00.0000000Z",
            new[] { new CapturedValue("disabledynamictick", "", "yes & shutdown /r", true) }
        );

        Assert.False(Tweak(runner).Revert(capture));
        Assert.Empty(runner.Runs);
    }
}
