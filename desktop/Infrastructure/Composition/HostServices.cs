namespace VeloSysPro
{
    /// <summary>
    /// Everything the running app is made of, wired together once.
    /// </summary>
    /// <remarks>
    /// This used to be a dozen lines in <c>MainWindow.xaml.cs</c>. Composition there is invisible to
    /// the test project — WPF code-behind is not in its compile list — and the cost was real: the
    /// Tweaks engine built its own <see cref="SafetyCheckpoint"/>, nothing wrote the user's stored
    /// "create a safety backup" answer into it at startup, and every batch of Tweaks after a restart
    /// created a restore point the user had turned off. Saving the Settings screen was the only
    /// thing that fixed it, which is not a fix anyone knows to perform (#53).
    ///
    /// Assembling it here is the actual repair. Sharing one checkpoint is a line of code; being able
    /// to assert that it is shared is what stops the next feature quietly doing the same thing.
    /// </remarks>
    public sealed class HostServices
    {
        /// <param name="events">
        /// Built by the caller rather than here, because the caller is usually also the
        /// <see cref="IStatusSink"/>: anything logged while this constructor runs has to reach an
        /// emitter that already exists.
        /// </param>
        /// <param name="settings">
        /// The settings store, injectable so a test can point it at a temporary file rather than at
        /// the user's real preferences.
        /// </param>
        public HostServices(
            IStatusSink sink,
            IpcEventEmitter events,
            string logsDir,
            string backupsDir,
            SettingsManager? settings = null
        )
        {
            Sink = sink;
            Events = events;
            Settings = settings ?? new SettingsManager();

            Commands = new CommandRunner(sink);
            RegistryBackups = new RegistryBackupManager(backupsDir, Commands, sink);
            SystemRestore = new SystemRestoreManager(Commands, sink);

            // One checkpoint, handed to every feature that can take one. A second instance is not a
            // duplicate object, it is a second answer to "did the user ask for a safety net?".
            Safety = new SafetyCheckpoint(SystemRestore, RegistryBackups, sink);

            Optimizer = new Optimizer(Commands, Safety, sink);
            Debloat = new DebloatManager(DebloatCatalog.CreateDefault(), Commands, Safety, sink);
            Tweaks = TweakEngine.CreateDefault(Commands, RegistryBackups, SystemRestore, Safety, sink);

            Scheduler = new SchedulerManager(Commands, sink);

            // Applied after everything is built, and once: the preference belongs to the checkpoint,
            // and every feature reads it through the same one. This is the line whose absence was
            // the bug — it used to reach only the features that happened to share the window's copy.
            Safety.Enabled = Settings.Current.CreateBackupBeforeOptimize;

            ActionHost = new ActionHost(
                Optimizer,
                RegistryBackups,
                SystemRestore,
                Scheduler,
                Settings,
                Tweaks,
                Debloat,
                Events,
                sink,
                logsDir,
                backupsDir
            );
        }

        public IStatusSink Sink { get; }
        public CommandRunner Commands { get; }
        public RegistryBackupManager RegistryBackups { get; }
        public SystemRestoreManager SystemRestore { get; }
        public SafetyCheckpoint Safety { get; }
        public Optimizer Optimizer { get; }
        public DebloatManager Debloat { get; }
        public TweakEngine Tweaks { get; }
        public SchedulerManager Scheduler { get; }
        public SettingsManager Settings { get; }
        public IpcEventEmitter Events { get; }
        public ActionHost ActionHost { get; }
    }
}
