using System.IO;
using Xunit;

namespace VeloSysPro.Tests;

/// <summary>
/// What the window wires together, asserted without a window.
/// </summary>
/// <remarks>
/// The composition used to live in `MainWindow.xaml.cs`, which is WPF and is not in this project's
/// compile list — so nothing could observe it, and the Tweaks path quietly went on creating a
/// restore point for a user who had turned that off (#53). These tests exist to make the wiring
/// observable, which is the actual fix; sharing one checkpoint is only the symptom.
/// </remarks>
public class HostServicesTests
{
    private static HostServices Build(TemporaryDirectory temp, bool safetyBackupEnabled)
    {
        var settings = new SettingsManager(Path.Combine(temp.Path, "settings.json"));
        settings.Save(settings.Current with { CreateBackupBeforeOptimize = safetyBackupEnabled });

        return new HostServices(
            new RecordingStatusSink(),
            new IpcEventEmitter(_ => { }),
            temp.Path,
            temp.Path,
            settings
        );
    }

    [Fact]
    public void EveryFeatureThatTakesASafetyCheckpointSharesTheSameOne()
    {
        // Set through one, read through another: only one object can answer both, so this fails the
        // moment a feature builds its own — which is what TweakEngine.CreateDefault used to do.
        using var temp = new TemporaryDirectory();
        HostServices services = Build(temp, safetyBackupEnabled: true);

        services.Optimizer.CreateSafetyBackupEnabled = false;

        Assert.False(
            services.Tweaks.CreateSafetyBackupEnabled,
            "The Tweaks engine is answering from a different SafetyCheckpoint than the Optimizer. "
                + "A user who turns the safety backup off would still get a restore point on every "
                + "batch of Tweaks (#53)."
        );
    }

    [Fact]
    public void TheSavedSafetyBackupPreferenceReachesEveryFeatureAtStartup()
    {
        // The bug as the user met it: turn the preference off, close the app, reopen it. Nothing
        // wrote the stored answer into the engine's own checkpoint until Settings was saved again,
        // so the first batch of Tweaks after a restart created a restore point regardless.
        using var temp = new TemporaryDirectory();
        HostServices services = Build(temp, safetyBackupEnabled: false);

        Assert.False(services.Optimizer.CreateSafetyBackupEnabled);
        Assert.False(
            services.Tweaks.CreateSafetyBackupEnabled,
            "A stored 'do not create a safety backup' was not applied to the Tweaks engine at "
                + "startup. Saving the Settings screen is what used to fix it, which is not a fix "
                + "the user knows to perform (#53)."
        );
    }

    [Fact]
    public void TheStoredPreferenceIsHonouredWhenItIsOn()
    {
        // The other direction, so the two guards above cannot both pass by always answering false.
        using var temp = new TemporaryDirectory();
        HostServices services = Build(temp, safetyBackupEnabled: true);

        Assert.True(services.Optimizer.CreateSafetyBackupEnabled);
        Assert.True(services.Tweaks.CreateSafetyBackupEnabled);
    }
}
