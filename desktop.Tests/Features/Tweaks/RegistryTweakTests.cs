using System.Linq;
using Xunit;

namespace VeloSysPro.Tests;

public class RegistryTweakTests
{
    private const string KeyPath = @"HKLM\SYSTEM\CurrentControlSet\Control\PriorityControl";

    private static RegistryTweak Tweak(
        ICommandRunner runner,
        RegistryBackupManager backup,
        params RegistryValue[] values
    ) =>
        new(
            "cpu.win32PrioritySeparation",
            TweakCategories.Cpu,
            RiskTier.Safe,
            KeyPath,
            values.Length == 0
                ? new[] { new RegistryValue("Win32PrioritySeparation", "REG_DWORD", "38") }
                : values,
            runner,
            backup
        );

    private static string QueryOutput(string name, string type, string data) =>
        "\r\nHKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl\r\n"
        + "    " + name + "    " + type + "    " + data + "\r\n\r\n";

    [Fact]
    public void Detect_QueriesTheExactValueAndReportsAppliedWhenItMatches()
    {
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner
        {
            // reg query prints DWORDs in hex; the desired value is written in decimal.
            CapturedOutput = QueryOutput("Win32PrioritySeparation", "REG_DWORD", "0x26"),
        };
        var sink = new RecordingStatusSink();
        var tweak = Tweak(runner, new RegistryBackupManager(temp.Path, runner, sink, temp.Path));

        Assert.Equal(TweakState.Applied, tweak.Detect());

        var (exe, args) = Assert.Single(runner.Runs);
        Assert.Equal("reg.exe", exe);
        Assert.Equal("query \"" + KeyPath + "\" /v \"Win32PrioritySeparation\"", args);
    }

    [Fact]
    public void Detect_ReportsNotAppliedWhenTheLiveValueDiffers()
    {
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner
        {
            CapturedOutput = QueryOutput("Win32PrioritySeparation", "REG_DWORD", "0x2"),
        };
        var sink = new RecordingStatusSink();

        Assert.Equal(
            TweakState.NotApplied,
            Tweak(runner, new RegistryBackupManager(temp.Path, runner, sink, temp.Path)).Detect()
        );
    }

    [Fact]
    public void Detect_ReportsNotAppliedWhenTheValueIsAbsent()
    {
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner
        {
            Result = new CommandResult(1, false),
            CapturedOutput = "ERROR: The system was unable to find the specified registry key",
        };
        var sink = new RecordingStatusSink();

        Assert.Equal(
            TweakState.NotApplied,
            Tweak(runner, new RegistryBackupManager(temp.Path, runner, sink, temp.Path)).Detect()
        );
    }

    [Fact]
    public void Detect_ReportsPartialWhenOnlySomeValuesOfTheGroupMatch()
    {
        using var temp = new TemporaryDirectory();
        var sink = new RecordingStatusSink();
        var runner = new ScriptedCommandRunner();
        runner.EnqueueCapture(QueryOutput("SystemResponsiveness", "REG_DWORD", "0xa"));
        runner.EnqueueCapture(QueryOutput("NetworkThrottlingIndex", "REG_DWORD", "0xa"));

        var tweak = Tweak(
            runner,
            new RegistryBackupManager(temp.Path, runner, sink, temp.Path),
            new RegistryValue("SystemResponsiveness", "REG_DWORD", "10"),
            new RegistryValue("NetworkThrottlingIndex", "REG_DWORD", "4294967295")
        );

        Assert.Equal(TweakState.Partial, tweak.Detect());
    }

    [Fact]
    public void Detect_QuotesAValueNameThatContainsSpaces()
    {
        // The MMCSS Games task spells its values "GPU Priority" and "Scheduling Category". Unquoted,
        // reg.exe reads the second word as a separate argument and the query fails, which the Tweak
        // would then report as "value absent" — and Revert would delete a value that was there.
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner
        {
            CapturedOutput = QueryOutput("GPU Priority", "REG_DWORD", "0x8"),
        };
        var sink = new RecordingStatusSink();
        var tweak = Tweak(
            runner,
            new RegistryBackupManager(temp.Path, runner, sink, temp.Path),
            new RegistryValue("GPU Priority", "REG_DWORD", "8")
        );

        Assert.Equal(TweakState.Applied, tweak.Detect());

        var (_, args) = Assert.Single(runner.Runs);
        Assert.Equal("query \"" + KeyPath + "\" /v \"GPU Priority\"", args);
    }

    [Fact]
    public void ApplyAndRevert_QuoteAValueNameThatContainsSpaces()
    {
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner();
        var sink = new RecordingStatusSink();
        var tweak = Tweak(
            runner,
            new RegistryBackupManager(temp.Path, runner, sink, temp.Path),
            new RegistryValue("Scheduling Category", "REG_SZ", "High")
        );

        Assert.True(tweak.Apply(new TweakCapture(tweak.Id, TweakKinds.Registry, "", new CapturedValue[0])));
        Assert.Equal(
            "add \"" + KeyPath + "\" /v \"Scheduling Category\" /t REG_SZ /d \"High\" /f",
            Assert.Single(runner.Runs).Args
        );

        runner.Runs.Clear();
        Assert.True(
            tweak.Revert(
                new TweakCapture(
                    tweak.Id,
                    TweakKinds.Registry,
                    "",
                    new[] { new CapturedValue("Scheduling Category", "REG_SZ", "", false) }
                )
            )
        );
        Assert.Equal(
            "delete \"" + KeyPath + "\" /v \"Scheduling Category\" /f",
            Assert.Single(runner.Runs).Args
        );
    }

    [Fact]
    public void Revert_DoesNotLetATrailingBackslashEscapeTheClosingQuote()
    {
        // Windows argument parsing treats a backslash as an escape only right before a quote, so
        // data ending in one would turn /d "C:\dir\" into an unterminated argument and let the rest
        // of the command line be reinterpreted. Revert is where it matters: this data comes back
        // off a capture file, not out of the catalog.
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner();
        var sink = new RecordingStatusSink();
        var tweak = Tweak(
            runner,
            new RegistryBackupManager(temp.Path, runner, sink, temp.Path),
            new RegistryValue("SomePath", "REG_SZ", "x")
        );

        Assert.True(
            tweak.Revert(
                new TweakCapture(
                    tweak.Id,
                    TweakKinds.Registry,
                    "",
                    new[] { new CapturedValue("SomePath", "REG_SZ", @"C:\dir\", true) }
                )
            )
        );

        Assert.Equal(
            "add \"" + KeyPath + "\" /v \"SomePath\" /t REG_SZ /d \"C:\\dir\\\\\" /f",
            Assert.Single(runner.Runs).Args
        );
    }

    [Fact]
    public void Apply_WritesTheDesiredValue()
    {
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner();
        var sink = new RecordingStatusSink();
        var tweak = Tweak(runner, new RegistryBackupManager(temp.Path, runner, sink, temp.Path));

        Assert.True(tweak.Apply(new TweakCapture(tweak.Id, TweakKinds.Registry, "", new CapturedValue[0])));

        var (exe, args) = Assert.Single(runner.Runs);
        Assert.Equal("reg.exe", exe);
        Assert.Equal(
            "add \"" + KeyPath + "\" /v \"Win32PrioritySeparation\" /t REG_DWORD /d \"38\" /f",
            args
        );
    }

    [Fact]
    public void Apply_ReportsFailureWhenTheRegistryWriteFails()
    {
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner { Result = new CommandResult(1, false) };
        var sink = new RecordingStatusSink();
        var tweak = Tweak(runner, new RegistryBackupManager(temp.Path, runner, sink, temp.Path));

        Assert.False(tweak.Apply(new TweakCapture(tweak.Id, TweakKinds.Registry, "", new CapturedValue[0])));
    }

    [Fact]
    public void Capture_RecordsThePriorValueAndExportsTheKey()
    {
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner
        {
            CapturedOutput = QueryOutput("Win32PrioritySeparation", "REG_DWORD", "0x2"),
        };
        var sink = new RecordingStatusSink();
        var tweak = Tweak(runner, new RegistryBackupManager(temp.Path, runner, sink, temp.Path));

        TweakCapture capture = tweak.Capture();

        CapturedValue value = Assert.Single(capture.Values);
        Assert.True(value.Existed);
        Assert.Equal("Win32PrioritySeparation", value.Name);
        Assert.Equal("REG_DWORD", value.Type);
        Assert.Equal("0x2", value.Data);
        Assert.EndsWith(".reg", capture.ArtifactFile);
        Assert.Contains(runner.Runs, run => run.Exe == "reg.exe" && run.Args.StartsWith("export "));
    }

    [Fact]
    public void Capture_MarksAValueThatDoesNotExistYet()
    {
        using var temp = new TemporaryDirectory();
        var sink = new RecordingStatusSink();
        var runner = new ScriptedCommandRunner();
        runner.EnqueueCapture("HKEY_LOCAL_MACHINE\\...\\PriorityControl\r\n"); // the key reads back
        runner.EnqueueFailedCapture(); // but this value is not in it
        var tweak = Tweak(runner, new RegistryBackupManager(temp.Path, runner, sink, temp.Path));

        CapturedValue value = Assert.Single(tweak.Capture().Values);

        Assert.False(value.Existed);
        Assert.Equal("", value.Data);
    }

    [Fact]
    public void Capture_RecordsNoValuesWhenTheKeyItselfCouldNotBeRead()
    {
        // reg query fails both for "the value is absent" and for "the key could not be read", and
        // treating the second as the first would make Revert delete a value that still exists.
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner { Result = new CommandResult(1, false) };
        var sink = new RecordingStatusSink();
        var tweak = Tweak(runner, new RegistryBackupManager(temp.Path, runner, sink, temp.Path));

        Assert.Empty(tweak.Capture().Values);
    }

    [Fact]
    public void Revert_NeverDeletesOnTheStrengthOfAKeyItCouldNotRead()
    {
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner { Result = new CommandResult(1, false) };
        var sink = new RecordingStatusSink();
        var tweak = Tweak(runner, new RegistryBackupManager(temp.Path, runner, sink, temp.Path));

        TweakCapture capture = tweak.Capture();
        runner.Runs.Clear();

        // No archive either (the export failed too), so the only honest answer is failure.
        Assert.False(tweak.Revert(capture));
        Assert.DoesNotContain(runner.Runs, run => run.Args.StartsWith("delete "));
    }

    [Fact]
    public void Revert_RestoresTheExactPriorValue()
    {
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner();
        var sink = new RecordingStatusSink();
        var tweak = Tweak(runner, new RegistryBackupManager(temp.Path, runner, sink, temp.Path));
        var capture = new TweakCapture(
            tweak.Id,
            TweakKinds.Registry,
            "2026-07-25T10:00:00.0000000Z",
            new[] { new CapturedValue("Win32PrioritySeparation", "REG_DWORD", "0x2", true) }
        );

        Assert.True(tweak.Revert(capture));

        var (exe, args) = Assert.Single(runner.Runs);
        Assert.Equal("reg.exe", exe);
        Assert.Equal(
            "add \"" + KeyPath + "\" /v \"Win32PrioritySeparation\" /t REG_DWORD /d \"0x2\" /f",
            args
        );
    }

    [Fact]
    public void Revert_DeletesAValueThatDidNotExistBeforeTheTweak()
    {
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner();
        var sink = new RecordingStatusSink();
        var tweak = Tweak(runner, new RegistryBackupManager(temp.Path, runner, sink, temp.Path));
        var capture = new TweakCapture(
            tweak.Id,
            TweakKinds.Registry,
            "2026-07-25T10:00:00.0000000Z",
            new[] { new CapturedValue("Win32PrioritySeparation", "REG_DWORD", "", false) }
        );

        Assert.True(tweak.Revert(capture));

        var (exe, args) = Assert.Single(runner.Runs);
        Assert.Equal("reg.exe", exe);
        Assert.Equal("delete \"" + KeyPath + "\" /v \"Win32PrioritySeparation\" /f", args);
    }

    [Fact]
    public void Revert_FallsBackToImportingTheArchiveWhenTheCaptureHasNoValues()
    {
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner();
        var sink = new RecordingStatusSink();
        string artifact = System.IO.Path.Combine(temp.Path, "cpu.win32PrioritySeparation_x.reg");
        System.IO.File.WriteAllText(artifact, "Windows Registry Editor Version 5.00");
        var tweak = Tweak(runner, new RegistryBackupManager(temp.Path, runner, sink, temp.Path));

        Assert.True(
            tweak.Revert(
                new TweakCapture(
                    tweak.Id,
                    TweakKinds.Registry,
                    "2026-07-25T10:00:00.0000000Z",
                    new CapturedValue[0],
                    artifact
                )
            )
        );

        var (exe, args) = Assert.Single(runner.Runs);
        Assert.Equal("reg.exe", exe);
        Assert.Equal("import \"" + artifact + "\"", args);
    }

    [Fact]
    public void Revert_RefusesACaptureWhoseValueNameCouldInjectCommandArguments()
    {
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner();
        var sink = new RecordingStatusSink();
        var tweak = Tweak(runner, new RegistryBackupManager(temp.Path, runner, sink, temp.Path));
        var capture = new TweakCapture(
            tweak.Id,
            TweakKinds.Registry,
            "2026-07-25T10:00:00.0000000Z",
            new[] { new CapturedValue("Win32PrioritySeparation\" /f & calc", "REG_DWORD", "0x2", true) }
        );

        Assert.False(tweak.Revert(capture));
        Assert.Empty(runner.Runs);
    }

    [Fact]
    public void Round_TripLeavesTheSystemBackAtItsOriginalValue()
    {
        using var temp = new TemporaryDirectory();
        var sink = new RecordingStatusSink();
        var runner = new ScriptedCommandRunner();
        runner.EnqueueCapture(QueryOutput("Win32PrioritySeparation", "REG_DWORD", "0x2")); // key probe
        runner.EnqueueCapture(QueryOutput("Win32PrioritySeparation", "REG_DWORD", "0x2")); // value

        var backup = new RegistryBackupManager(temp.Path, runner, sink, temp.Path);
        var tweak = Tweak(runner, backup);

        TweakCapture capture = tweak.Capture();
        Assert.True(tweak.Apply(capture));
        Assert.True(tweak.Revert(capture));

        string restore = runner.Runs.Last().Args;
        Assert.Contains("/d \"0x2\"", restore);
        Assert.Equal(
            new[] { "0x2" },
            capture.Values.Select(value => value.Data)
        );
    }

    /// <summary>The same Tweak, allowed to create the key it writes under (a Policies branch).</summary>
    private static RegistryTweak KeyCreatingTweak(
        ICommandRunner runner,
        RegistryBackupManager backup
    ) =>
        new(
            "windows.policy",
            TweakCategories.System,
            RiskTier.Safe,
            KeyPath,
            new[] { new RegistryValue("Policy", "REG_DWORD", "1") },
            runner,
            backup,
            requiresReboot: false,
            requiresExistingValue: false,
            keyMayBeAbsent: true
        );

    [Fact]
    public void Revert_RemovesAKeyItCreatedOnceNothingIsLeftInIt()
    {
        // The mechanism on its own, away from the catalog: an unreadable key at capture time, an
        // empty one at revert time, and this Tweak is allowed to create the key it writes under.
        using var temp = new TemporaryDirectory();
        var sink = new RecordingStatusSink();
        var runner = new ScriptedCommandRunner();
        var tweak = KeyCreatingTweak(runner, new RegistryBackupManager(temp.Path, runner, sink, temp.Path));

        TweakCapture capture = tweak.Capture(); // no script: the key does not read back
        Assert.False(capture.KeyWasReadable);
        Assert.True(tweak.Apply(capture));

        runner.Runs.Clear();
        runner.EnqueueCapture("\r\n"); // reg.exe's answer for a key holding nothing

        Assert.True(tweak.Revert(capture));
        Assert.Equal(
            new[]
            {
                "delete \"" + KeyPath + "\" /v \"Policy\" /f",
                "query \"" + KeyPath + "\"",
                "delete \"" + KeyPath + "\" /f",
            },
            runner.Runs.Select(run => run.Args)
        );
    }

    [Fact]
    public void Revert_StillReportsSuccessWhenOnlyTheLeftoverKeyCouldNotBeRemoved()
    {
        // The prior state is restored by the time the key is considered. An empty key nobody reads
        // is cosmetic, so failing the whole Revert over it would report a failure that did not
        // happen and that the user cannot act on.
        using var temp = new TemporaryDirectory();
        var sink = new RecordingStatusSink();
        var runner = new ScriptedCommandRunner();
        var tweak = KeyCreatingTweak(runner, new RegistryBackupManager(temp.Path, runner, sink, temp.Path));

        TweakCapture capture = tweak.Capture();
        Assert.True(tweak.Apply(capture));

        runner.Runs.Clear();
        runner.EnqueueCapture("\r\n");
        // Only the key delete fails. Failing every command would make the value delete fail first,
        // which is a different outcome and would never reach the line under test.
        runner.FailingRunsByArgs.Add("delete \"" + KeyPath + "\" /f");

        Assert.True(tweak.Revert(capture));
        Assert.Contains(runner.Runs, run => run.Args == "delete \"" + KeyPath + "\" /f");
    }
}
