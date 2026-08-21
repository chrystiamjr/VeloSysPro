using System;
using System.Collections.Generic;
using System.Linq;

namespace VeloSysPro
{
    /// <summary>A named, curated selection of Tweaks the user can adjust before applying.</summary>
    public sealed record Preset(string Id, IReadOnlyList<string> TweakIds);

    /// <summary>
    /// The registry of every Tweak VeloSys Pro ships, plus the Presets defined over them.
    /// </summary>
    /// <remarks>
    /// A Preset is keyed by the headless CLI task name it answers to, so a scheduled
    /// <c>VeloSysPro.exe --task=gaming</c> written before the à-la-carte catalog existed keeps
    /// working (docs/adr/0003-tweak-as-reversible-unit.md). Preset ids and the remaining
    /// <see cref="OptimizationPlan"/> names therefore share one namespace and must not collide —
    /// <c>--task=</c> would otherwise mean two different things.
    /// </remarks>
    public sealed class TweakCatalog
    {
        private readonly Dictionary<string, ITweak> _byId;

        public TweakCatalog(
            IReadOnlyList<ITweak> tweaks,
            IReadOnlyDictionary<string, IReadOnlyList<string>> presets,
            IReadOnlyList<string>? recommended = null
        )
        {
            _byId = new Dictionary<string, ITweak>(StringComparer.Ordinal);
            foreach (ITweak tweak in tweaks)
            {
                if (!_byId.TryAdd(tweak.Id, tweak))
                    throw new ArgumentException("Duplicate Tweak id: " + tweak.Id);
            }

            foreach (KeyValuePair<string, IReadOnlyList<string>> preset in presets)
            {
                foreach (string id in preset.Value)
                {
                    if (!_byId.TryGetValue(id, out ITweak? tweak))
                        throw new ArgumentException(
                            "Preset '" + preset.Key + "' references unknown Tweak: " + id
                        );

                    if (tweak.RiskTier == RiskTier.Advanced)
                        throw new ArgumentException(
                            "Preset '" + preset.Key + "' may not reference the Advanced Tweak: " + id
                        );
                }
            }

            foreach (string id in recommended ?? Array.Empty<string>())
            {
                if (!_byId.TryGetValue(id, out ITweak? tweak))
                    throw new ArgumentException("Unknown recommended Tweak: " + id);
                if (tweak.RiskTier == RiskTier.Advanced)
                    throw new ArgumentException("Advanced Tweak may not be recommended: " + id);
                if (tweak.RequiresReboot)
                    throw new ArgumentException(
                        "A Tweak that needs a restart may not be recommended: " + id
                    );
            }

            Tweaks = tweaks;
            Recommended = recommended ?? Array.Empty<string>();
            Presets = presets.Select(preset => new Preset(preset.Key, preset.Value)).ToList();
        }

        public IReadOnlyList<ITweak> Tweaks { get; }

        public IReadOnlyList<Preset> Presets { get; }

        /// <summary>
        /// The Tweaks the catalog stands behind for someone who does not want to read every entry.
        /// Curation, not a Preset: it is one control, it may only name `Safe` Tweaks, and it leaves
        /// out anything that needs a restart to take effect.
        /// </summary>
        public IReadOnlyList<string> Recommended { get; }

        public ITweak? Find(string id) => _byId.TryGetValue(id, out ITweak? tweak) ? tweak : null;

        /// <summary>
        /// The Multimedia Class Scheduler Service key.
        /// </summary>
        /// <remarks>
        /// Under <c>SOFTWARE\Microsoft\Windows NT</c>, not under <c>SYSTEM\CurrentControlSet\Control</c>
        /// where the source guides place it — that key does not exist on Windows 11, verified on a
        /// real machine on 2026-07-27. Writing there would have created a key nothing reads, and
        /// every one of these Tweaks would have reported success while changing nothing.
        /// </remarks>
        private const string MmcssProfile =
            @"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile";

        /// <summary>
        /// The shipped catalog: every Safe optimization VeloSys Pro knows how to apply and undo.
        /// </summary>
        /// <remarks>
        /// Grouping is by what the user recognizes, not by which hive the value lives in — the MMCSS
        /// key holds both a scheduler setting (<c>cpu</c>) and a network one (<c>network</c>), and
        /// they are separate Tweaks so either can be reverted on its own.
        /// </remarks>
        public static TweakCatalog CreateDefault(ICommandRunner cmd, RegistryBackupManager backup)
        {
            var win32PrioritySeparation = new RegistryTweak(
                "cpu.win32PrioritySeparation",
                TweakCategories.Cpu,
                RiskTier.Safe,
                @"HKLM\SYSTEM\CurrentControlSet\Control\PriorityControl",
                // 38 == 0x26: short, fixed-length quanta biased to the foreground application.
                new[] { new RegistryValue("Win32PrioritySeparation", "REG_DWORD", "38") },
                cmd,
                backup
            );

            var systemResponsiveness = new RegistryTweak(
                "cpu.systemResponsiveness",
                TweakCategories.Cpu,
                RiskTier.Safe,
                MmcssProfile,
                // The share of CPU MMCSS reserves for background work. Windows ships 20; 10 hands
                // the rest back to the foreground multimedia task.
                new[] { new RegistryValue("SystemResponsiveness", "REG_DWORD", "10") },
                cmd,
                backup
            );

            var gamesTaskPriority = new RegistryTweak(
                "cpu.gamesTaskPriority",
                TweakCategories.Cpu,
                RiskTier.Safe,
                MmcssProfile + @"\Tasks\Games",
                // One Tweak, three values: they describe a single scheduling profile, and half of
                // it applied is exactly what TweakState.Partial exists to show.
                new[]
                {
                    new RegistryValue("GPU Priority", "REG_DWORD", "8"),
                    new RegistryValue("Priority", "REG_DWORD", "6"),
                    new RegistryValue("Scheduling Category", "REG_SZ", "High"),
                },
                cmd,
                backup
            );

            var networkThrottling = new RegistryTweak(
                "network.throttlingIndex",
                TweakCategories.Network,
                RiskTier.Safe,
                MmcssProfile,
                // 0xffffffff is the documented "no throttling" sentinel, not a count.
                new[] { new RegistryValue("NetworkThrottlingIndex", "REG_DWORD", "4294967295") },
                cmd,
                backup
            );

            var tcpParameters = new RegistryTweak(
                "network.tcpParameters",
                TweakCategories.Network,
                RiskTier.Safe,
                @"HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters",
                new[]
                {
                    new RegistryValue("DefaultTTL", "REG_DWORD", "64"),
                    new RegistryValue("Tcp1323Opts", "REG_DWORD", "1"),
                    new RegistryValue("TCPTimedWaitDelay", "REG_DWORD", "30"),
                    new RegistryValue("MaxUserPort", "REG_DWORD", "65534"),
                },
                cmd,
                backup,
                // The TCP/IP driver reads these once, as it starts.
                requiresReboot: true
            );

            var fullscreenExclusive = new RegistryTweak(
                "graphics.fullscreenExclusive",
                TweakCategories.Graphics,
                RiskTier.Safe,
                // The location Windows itself uses; both values were read here on a real machine on
                // 2026-07-27 rather than being taken from a guide.
                @"HKCU\System\GameConfigStore",
                new[]
                {
                    new RegistryValue("GameDVR_FSEBehaviorMode", "REG_DWORD", "2"),
                    new RegistryValue("GameDVR_HonorUserFSEBehaviorMode", "REG_DWORD", "1"),
                },
                cmd,
                backup
            );

            var hardwareScheduling = new RegistryTweak(
                "graphics.hardwareScheduling",
                TweakCategories.Graphics,
                RiskTier.Safe,
                @"HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers",
                new[] { new RegistryValue("HwSchMode", "REG_DWORD", "2") },
                cmd,
                backup,
                requiresReboot: true,
                // Windows creates HwSchMode itself where the display driver supports the feature —
                // it is absent on the machine this was verified against. Creating it elsewhere
                // would report an optimization the driver is never going to honour.
                requiresExistingValue: true
            );

            var gameMode = new RegistryTweak(
                "graphics.gameMode",
                TweakCategories.Graphics,
                RiskTier.Safe,
                @"HKCU\Software\Microsoft\GameBar",
                new[] { new RegistryValue("AllowAutoGameMode", "REG_DWORD", "1") },
                cmd,
                backup
            );

            var visualEffects = new RegistryTweak(
                "system.visualEffects",
                TweakCategories.System,
                RiskTier.Safe,
                @"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects",
                // 2 == "Adjust for best performance" in the Performance Options dialog.
                new[] { new RegistryValue("VisualFXSetting", "REG_DWORD", "2") },
                cmd,
                backup,
                // Explorer reads this as it starts, so the desktop keeps its animations until the
                // user signs out. Treated as needing a restart because that is what they must do.
                requiresReboot: true
            );

            var powerPlan = new PowerPlanTweak(
                "system.powerPlan",
                TweakCategories.System,
                RiskTier.Safe,
                cmd
            );

            var disableDynamicTick = new BcdTweak(
                "boot.disableDynamicTick",
                TweakCategories.Boot,
                RiskTier.Safe,
                "disabledynamictick",
                "yes",
                cmd
            );

            var platformTick = new BcdTweak(
                "boot.platformTick",
                TweakCategories.Boot,
                RiskTier.Safe,
                "useplatformtick",
                "yes",
                cmd
            );

            // The goal here is the element's absence, not a value: the research catalog states this
            // one as "remove useplatformclock", letting Windows pick its own timer source again.
            var platformClock = new BcdTweak(
                "boot.platformClock",
                TweakCategories.Boot,
                RiskTier.Safe,
                "useplatformclock",
                null,
                cmd
            );

            // The Safe service set: each one is told when it may start, never whether it may run.
            // All four target Manual, and ServiceTweak compares by how early a start type lets the
            // service run — so a machine that already has one Disabled is left alone rather than
            // loosened to Manual and reported as an improvement.
            var sysMain = new ServiceTweak(
                "services.sysMain",
                TweakCategories.Services,
                RiskTier.Safe,
                "SysMain",
                "Manual",
                cmd
            );

            var diagTrack = new ServiceTweak(
                "services.diagTrack",
                TweakCategories.Services,
                RiskTier.Safe,
                "DiagTrack",
                "Manual",
                cmd
            );

            var wSearch = new ServiceTweak(
                "services.wSearch",
                TweakCategories.Services,
                RiskTier.Safe,
                "WSearch",
                "Manual",
                cmd
            );

            var doSvc = new ServiceTweak(
                "services.doSvc",
                TweakCategories.Services,
                RiskTier.Safe,
                "DoSvc",
                "Manual",
                cmd
            );

            return new TweakCatalog(
                new ITweak[]
                {
                    win32PrioritySeparation,
                    systemResponsiveness,
                    gamesTaskPriority,
                    networkThrottling,
                    tcpParameters,
                    fullscreenExclusive,
                    hardwareScheduling,
                    gameMode,
                    visualEffects,
                    powerPlan,
                    disableDynamicTick,
                    platformTick,
                    platformClock,
                    sysMain,
                    diagTrack,
                    wSearch,
                    doSvc,
                },
                new Dictionary<string, IReadOnlyList<string>>
                {
                    // Everything that serves a game and can be applied on any machine.
                    //
                    // Two deliberate omissions. Visual Effects changes how Windows looks, which is
                    // not a side effect anyone clicking "gaming" is asking for. GPU Hardware
                    // Scheduling refuses to apply where the display driver never exposed
                    // `HwSchMode` — the common case — and a Preset is applied wholesale by the
                    // scheduler, so including it would make every headless `--task=gaming` run
                    // report failure on those machines. It stays individually selectable.
                    ["gaming"] = new[]
                    {
                        win32PrioritySeparation.Id,
                        systemResponsiveness.Id,
                        gamesTaskPriority.Id,
                        networkThrottling.Id,
                        tcpParameters.Id,
                        fullscreenExclusive.Id,
                        gameMode.Id,
                        powerPlan.Id,
                        disableDynamicTick.Id,
                        platformTick.Id,
                        platformClock.Id,
                        sysMain.Id,
                        diagTrack.Id,
                        doSvc.Id,
                    },
                },
                // One click for someone who will not read the list, so it holds only what suits any
                // machine and acts immediately. The constructor enforces the "no restart" half; the
                // two judgement calls it cannot are the power plan, which costs battery on a laptop,
                // and forced fullscreen-exclusive, which is a preference rather than a gain.
                new[]
                {
                    win32PrioritySeparation.Id,
                    systemResponsiveness.Id,
                    gamesTaskPriority.Id,
                    networkThrottling.Id,
                    gameMode.Id,
                    sysMain.Id,
                    diagTrack.Id,
                    doSvc.Id,
                }
            );
        }
    }
}
