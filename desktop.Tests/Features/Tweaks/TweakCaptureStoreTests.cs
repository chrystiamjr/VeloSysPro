using System.IO;
using System.Threading;
using Xunit;

namespace VeloSysPro.Tests;

public class TweakCaptureStoreTests
{
    private static TweakCapture Capture(string tweakId, string data) =>
        new(
            tweakId,
            TweakKinds.Registry,
            "2026-07-25T10:00:00.0000000Z",
            new[] { new CapturedValue("Win32PrioritySeparation", "REG_DWORD", data, true) },
            "C:\\captures\\cpu.reg"
        );

    [Fact]
    public void LoadLatest_ReadsACaptureWrittenBeforeTheKeyFieldAsReadable()
    {
        // Captures are persisted and read back by later versions. One written before
        // `KeyWasReadable` existed never observed the key at all, and true is the answer that
        // changes nothing: Revert restores the values and leaves the key alone, exactly as the
        // version that wrote this file did (#51).
        using var temp = new TemporaryDirectory();
        File.WriteAllText(
            Path.Combine(temp.Path, "cpu.win32PrioritySeparation_20260725-100000000.json"),
            """
            {
              "tweakId": "cpu.win32PrioritySeparation",
              "kind": "registry",
              "capturedAt": "2026-07-25T10:00:00.0000000Z",
              "values": [
                { "name": "Win32PrioritySeparation", "type": "REG_DWORD", "data": "0x2", "existed": true }
              ],
              "artifactFile": "C:\\captures\\cpu.reg"
            }
            """
        );

        TweakCapture? loaded = new JsonTweakCaptureStore(temp.Path).LoadLatest(
            "cpu.win32PrioritySeparation"
        );

        Assert.NotNull(loaded);
        Assert.True(
            loaded!.KeyWasReadable,
            "A capture with no `keyWasReadable` field must read back as true. False would let "
                + "Revert delete a registry key that the capture never observed at all."
        );
        Assert.Equal("0x2", Assert.Single(loaded.Values).Data);
    }

    [Fact]
    public void LoadLatest_RoundTripsEveryFieldOfASavedCapture()
    {
        using var temp = new TemporaryDirectory();
        var store = new JsonTweakCaptureStore(temp.Path);

        store.Save(Capture("cpu.win32PrioritySeparation", "0x2"));

        TweakCapture? loaded = new JsonTweakCaptureStore(temp.Path).LoadLatest(
            "cpu.win32PrioritySeparation"
        );

        Assert.NotNull(loaded);
        Assert.Equal("cpu.win32PrioritySeparation", loaded!.TweakId);
        Assert.Equal(TweakKinds.Registry, loaded.Kind);
        Assert.Equal("2026-07-25T10:00:00.0000000Z", loaded.CapturedAt);
        Assert.Equal("C:\\captures\\cpu.reg", loaded.ArtifactFile);
        CapturedValue value = Assert.Single(loaded.Values);
        Assert.Equal("Win32PrioritySeparation", value.Name);
        Assert.Equal("REG_DWORD", value.Type);
        Assert.Equal("0x2", value.Data);
        Assert.True(value.Existed);
    }

    [Fact]
    public void LoadLatest_ReturnsTheMostRecentCaptureForTheTweak()
    {
        using var temp = new TemporaryDirectory();
        var store = new JsonTweakCaptureStore(temp.Path);

        store.Save(Capture("cpu.win32PrioritySeparation", "0x2"));
        Thread.Sleep(5); // the file name carries a millisecond stamp
        store.Save(Capture("cpu.win32PrioritySeparation", "0x18"));

        Assert.Equal("0x18", store.LoadLatest("cpu.win32PrioritySeparation")!.Values[0].Data);
    }

    [Fact]
    public void LoadLatest_KeepsCapturesOfDifferentTweaksApart()
    {
        using var temp = new TemporaryDirectory();
        var store = new JsonTweakCaptureStore(temp.Path);

        store.Save(Capture("cpu.win32PrioritySeparation", "0x2"));
        store.Save(Capture("boot.disableDynamicTick", "No"));

        Assert.Equal("0x2", store.LoadLatest("cpu.win32PrioritySeparation")!.Values[0].Data);
        Assert.Equal("No", store.LoadLatest("boot.disableDynamicTick")!.Values[0].Data);
    }

    [Fact]
    public void LoadLatest_ReturnsNothingWhenTheTweakWasNeverApplied()
    {
        using var temp = new TemporaryDirectory();

        Assert.Null(new JsonTweakCaptureStore(temp.Path).LoadLatest("services.sysMain"));
    }

    [Fact]
    public void LoadLatest_SkipsACorruptFileAndFallsBackToTheOlderValidCapture()
    {
        using var temp = new TemporaryDirectory();
        var store = new JsonTweakCaptureStore(temp.Path);
        store.Save(Capture("cpu.win32PrioritySeparation", "0x2"));

        File.WriteAllText(
            Path.Combine(temp.Path, "cpu.win32PrioritySeparation_29991231-235959999.json"),
            "{\"tweakId\":\"cpu.win"
        );

        Assert.Equal("0x2", store.LoadLatest("cpu.win32PrioritySeparation")!.Values[0].Data);
    }

    [Fact]
    public void Save_RefusesATweakIdThatCouldEscapeTheCapturesDirectory()
    {
        using var temp = new TemporaryDirectory();
        var store = new JsonTweakCaptureStore(temp.Path);

        Assert.Throws<System.ArgumentException>(() => store.Save(Capture("..\\..\\evil", "0x2")));
        Assert.Empty(Directory.GetFiles(temp.Path));
    }

    [Fact]
    public void LoadLatest_RefusesATweakIdThatCouldEscapeTheCapturesDirectory()
    {
        using var temp = new TemporaryDirectory();

        Assert.Null(new JsonTweakCaptureStore(temp.Path).LoadLatest("..\\..\\evil"));
    }
}
