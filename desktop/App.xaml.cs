using System;
using System.IO;
using System.Linq;
using System.Windows;

namespace VeloSysPro
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            // Headless CLI mode for scheduled tasks: VeloSysPro.exe --task=<quick|full|gaming|revert>
            string? task = e.Args
                .FirstOrDefault(a => a.StartsWith("--task=", StringComparison.OrdinalIgnoreCase))
                ?.Substring("--task=".Length);

            if (!string.IsNullOrWhiteSpace(task))
            {
                RunHeadless(task);
                Shutdown(0);
                return;
            }

            base.OnStartup(e);
            new MainWindow().Show();
        }

        private static void RunHeadless(string task)
        {
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string logsDir = Path.Combine(appDir, "logs");
            string backupsDir = Path.Combine(appDir, "backups");
            Directory.CreateDirectory(logsDir);
            Directory.CreateDirectory(backupsDir);

            var sink = new FileStatusSink(Path.Combine(logsDir, "scheduled_task_log.txt"));
            var cmd = new CommandRunner(sink);
            var backup = new BackupManager(backupsDir, cmd, sink);
            var optimizer = new Optimizer(cmd, backup, sink);

            sink.LogRaw($"=== Headless task '{task}' started ===", "info");
            if (!optimizer.RunByName(task))
            {
                sink.LogRaw($"Unknown task '{task}'", "error");
            }
            sink.LogRaw($"=== Headless task '{task}' finished ===", "info");
        }
    }
}
