using System.IO;
using Xunit;

namespace VeloSysPro.Tests;

public class SettingsManagerTests
{
    [Fact]
    public void Save_PersistsAndReloadsAllSettings()
    {
        using var temp = new TemporaryDirectory();
        string file = Path.Combine(temp.Path, "settings.json");
        var manager = new SettingsManager(file);

        manager.Save(
            """{"language":"en_US","createBackupBeforeOptimize":false,"sidebarCollapsed":true}"""
        );
        var reloaded = new SettingsManager(file);

        Assert.Equal("en_US", reloaded.Current.Language);
        Assert.False(reloaded.Current.CreateBackupBeforeOptimize);
        Assert.True(reloaded.Current.SidebarCollapsed);
    }

    [Fact]
    public void Save_KeepsCurrentSettingsForMalformedJson()
    {
        using var temp = new TemporaryDirectory();
        var manager = new SettingsManager(Path.Combine(temp.Path, "settings.json"));

        var result = manager.Save("{invalid");

        Assert.Equal("pt_BR", result.Language);
        Assert.True(result.CreateBackupBeforeOptimize);
    }
}
