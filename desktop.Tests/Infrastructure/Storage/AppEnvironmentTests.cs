using System;
using System.IO;
using Xunit;

namespace VeloSysPro.Tests
{
    public class AppEnvironmentTests
    {
        [Fact]
        public void Default_ResolvesLocalAppDataPath()
        {
            var env = AppEnvironment.Default;
            Assert.Contains("VeloSysPro", env.Root);
            Assert.Equal(Path.Combine(env.Root, "logs"), env.Logs);
            Assert.Equal(Path.Combine(env.Root, "backups"), env.Backups);
            Assert.Equal(Path.Combine(env.Root, "captures"), env.Captures);
            Assert.Equal(Path.Combine(env.Root, "settings.json"), env.SettingsFile);
            Assert.Equal(Path.Combine(env.Root, "history.jsonl"), env.HistoryFile);
        }

        [Fact]
        public void CustomRoot_OverridesPathTopology()
        {
            string tempDir = Path.Combine(Path.GetTempPath(), "VeloSysPro_Test_" + Guid.NewGuid());
            try
            {
                var env = new AppEnvironment(tempDir);
                Assert.Equal(tempDir, env.Root);
                Assert.Equal(Path.Combine(tempDir, "logs"), env.Logs);

                env.EnsureRuntimeDirectories();
                Assert.True(Directory.Exists(env.Logs));
                Assert.True(Directory.Exists(env.Backups));
                Assert.True(Directory.Exists(env.Captures));
                Assert.True(Directory.Exists(env.WebViewData));
            }
            finally
            {
                if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
            }
        }
    }
}
