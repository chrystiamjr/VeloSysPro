using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Windows;

namespace VeloSysPro
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            if (e.Args.Any(a => a.Equals("--version", StringComparison.OrdinalIgnoreCase) || a.Equals("-v", StringComparison.OrdinalIgnoreCase)))
            {
                Console.WriteLine($"VeloSysPro {GetAppVersion()}");
                Shutdown(0);
                return;
            }

            if (e.Args.Any(a => a.Equals("--help", StringComparison.OrdinalIgnoreCase) || a.Equals("-h", StringComparison.OrdinalIgnoreCase)))
            {
                Console.WriteLine("VeloSysPro - High Performance Windows Optimizer");
                Console.WriteLine("Usage: VeloSysPro.exe [options]");
                Console.WriteLine("Options:");
                Console.WriteLine("  --version, -v           Show version information");
                Console.WriteLine("  --help, -h              Show help information");
                Console.WriteLine("  --task=<task_name>      Run scheduled optimization task in headless mode");
                Shutdown(0);
                return;
            }

            // Headless CLI mode for scheduled tasks: VeloSysPro.exe --task=<quick|full|gaming|revert>
            // where "gaming" is a Tweak Preset and the rest are maintenance Optimization Plans.
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

        /// <summary>
        /// Runs one scheduled task by the name written into its <c>--task=</c> argument.
        /// </summary>
        /// <remarks>
        /// Presets are resolved first: <c>gaming</c> used to be an <see cref="OptimizationPlan"/>
        /// that wrote TCP globals with no capture and no undo, and is now the Preset of the same
        /// name over reversible Tweaks. Existing scheduled entries keep their argument and get the
        /// safer behaviour. The remaining Plans are maintenance work, which owns no Tweaks.
        /// </remarks>
        private static void RunHeadless(string task)
        {
            AppPaths.EnsureRuntimeDirectories();

            var sink = new FileStatusSink(Path.Combine(AppPaths.Logs, "scheduled_task_log.txt"));
            var cmd = new CommandRunner(sink);
            var backup = new RegistryBackupManager(AppPaths.Backups, cmd, sink);

            sink.LogRaw($"=== Headless task '{task}' started ===", "info");

            TweakEngine tweaks = TweakEngine.CreateDefault(
                cmd,
                backup,
                new SystemRestoreManager(cmd, sink),
                sink
            );

            // The same preference the window applies. A user who turned the safety backup off did
            // so to opt out of the Safety Checkpoint; ignoring that here would make every scheduled
            // run abort on a machine with System Protection disabled.
            tweaks.CreateSafetyBackupEnabled = new SettingsManager()
                .Current
                .CreateBackupBeforeOptimize;

            bool ok = tweaks.HasPreset(task)
                ? tweaks.ApplyPreset(task)
                : new Optimizer(cmd, backup, sink).RunByName(task);

            if (!ok) sink.LogRaw($"Task '{task}' is unknown or did not complete", "error");
            sink.LogRaw($"=== Headless task '{task}' finished ===", "info");
        }

        private static string GetAppVersion() =>
            SemanticVersion.FromAssembly(typeof(App).Assembly).ToString();
    }
}
