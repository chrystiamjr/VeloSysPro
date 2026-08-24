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
            // Shared so the "does this machine have the feature?" round trip is paid once per
            // process rather than once per Tweak that asks.
            var features = new WindowsOptionalFeatures(cmd);

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

            // E8-03 specified two values, `GameDVR_Enabled` here and `AppCaptureEnabled` under the
            // per-user GameDVR key. Read live on 2026-08-23 (Windows 11 Pro 26200): the first is
            // present at 1; the second does not exist anywhere in HKCU. They also sit under
            // different keys, which one RegistryTweak cannot own. Shipping only the value the
            // machine exposes is the rule this epic exists to follow — the ticket's paths are a
            // starting point for verification, not a specification. `windows.startupAds` carries
            // the multi-value Partial case instead.
            //
            // Game Bar itself, `ShowStartupPanel` and the Xbox services are deliberately untouched:
            // turning off background capture is not the same as removing the overlay.
            var gameDvrCapture = new RegistryTweak(
                "graphics.gameDvrCapture",
                TweakCategories.Graphics,
                RiskTier.Safe,
                @"HKCU\System\GameConfigStore",
                new[] { new RegistryValue("GameDVR_Enabled", "REG_DWORD", "0") },
                cmd,
                backup,
                requiresReboot: false,
                // Not a Policies branch. Windows writes this value itself, so an absent one is a
                // capture stack this build does not expose and creating it would be writing
                // something nothing reads — the rule every entry outside `Policies` follows.
                requiresExistingValue: true
            );

            var transparency = new RegistryTweak(
                "system.transparency",
                TweakCategories.System,
                RiskTier.Safe,
                // Read live on 2026-08-23: `EnableTransparency` is present at 1, beside the theme
                // values Windows keeps in the same key. This is the switch Settings >
                // Personalization > Colors writes.
                @"HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize",
                new[] { new RegistryValue("EnableTransparency", "REG_DWORD", "0") },
                cmd,
                backup,
                requiresReboot: false,
                // As above: Settings owns this value, so absence means this build does not offer
                // the switch rather than that nobody has flipped it yet.
                requiresExistingValue: true
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

            // ---- Policy branches -------------------------------------------------------------
            //
            // The three Tweaks below write under a `Policies` key, and that is the one place where
            // creating a value the machine does not already have is the supported mechanism rather
            // than a mistake: Windows reads these keys whether or not an administrator has created
            // them, and creating them is exactly what Group Policy does. Everywhere else,
            // `RegistryTweak`'s `requiresExistingValue` guard is what stops us writing a value
            // nothing reads — `graphics.hardwareScheduling` above is the case it was built for,
            // where an absent `HwSchMode` means the display driver never offered the feature and a
            // created one would be ignored for good.
            //
            // Each capture records the absence faithfully, so Revert deletes what it created rather
            // than writing a zero. A zero is a value; absence is not, and the difference is what a
            // policy means to Windows.

            var copilotPolicy = new RegistryTweak(
                "windows.copilotPolicy",
                TweakCategories.Windows,
                RiskTier.Safe,
                // HKCU, not HKLM. Read live on 2026-08-23: WindowsCopilot.admx on this build
                // declares TurnOffWindowsCopilot as class="User", and the CSP's own mapping
                // (PolicyManager\default\WindowsAI\TurnOffWindowsCopilot) redirects it to
                // Software\Policies\Microsoft\Windows\WindowsCopilot with allowedValues "0,1".
                // Both hives are written about; only the user one is what Windows honours here.
                @"HKCU\Software\Policies\Microsoft\Windows\WindowsCopilot",
                new[] { new RegistryValue("TurnOffWindowsCopilot", "REG_DWORD", "1") },
                cmd,
                backup,
                requiresReboot: false,
                requiresExistingValue: false,
                keyMayBeAbsent: true
            );

            // Recall is a Copilot+ PC feature. On any other machine the policy write succeeds and
            // configures something that is not there, which is why this is the entry TweakState
            // .Unsupported was added for. Presence is asked of the capability — the optional
            // feature list — never of the policy value, because an unset policy on a Copilot+ PC
            // and a machine without Recall are indistinguishable in the registry.
            var recall = new SupportGatedTweak(
                new RegistryTweak(
                    "windows.recall",
                    TweakCategories.Windows,
                    RiskTier.Safe,
                    // class="Both" in WindowsCopilot.admx, read live on 2026-08-23, with the CSP
                    // redirecting to Software\Policies\Microsoft\Windows\WindowsAI. HKLM is the
                    // half that covers every account on the machine, which is what someone turning
                    // off screen-snapshotting is asking for.
                    @"HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsAI",
                    new[] { new RegistryValue("DisableAIDataAnalysis", "REG_DWORD", "1") },
                    cmd,
                    backup,
                    requiresReboot: false,
                    requiresExistingValue: false,
                    keyMayBeAbsent: true
                ),
                () => features.Exists("Recall")
            );

            var deliveryOptimization = new RegistryTweak(
                "network.deliveryOptimization",
                TweakCategories.Network,
                RiskTier.Safe,
                // class="Machine" in DeliveryOptimization.admx, read live on 2026-08-23, so HKLM.
                @"HKLM\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization",
                // 0 is "HTTP only, no peering" — quoted from this build's own
                // DeliveryOptimization.adml, not from a guide. Content still comes from Microsoft
                // over HTTP; what stops is this machine uploading it to other PCs. That is the
                // supported way to reach the goal `services.doSvc` reached by stopping the service,
                // which can slow or break updates and which Windows may undo on its own. doSvc
                // stays in the catalog and stays revertible; this replaces its mechanism, not it.
                new[] { new RegistryValue("DODownloadMode", "REG_DWORD", "0") },
                cmd,
                backup,
                requiresReboot: false,
                requiresExistingValue: false,
                keyMayBeAbsent: true
            );

            // Every value read live on 2026-08-23 under the per-user ContentDeliveryManager key —
            // all four present, all four at 1 — rather than taken from a guide's longer list. One
            // Tweak owning the set, so a machine where only some of them match reports Partial.
            var startupAds = new RegistryTweak(
                "windows.startupAds",
                TweakCategories.Windows,
                RiskTier.Safe,
                @"HKCU\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager",
                new[]
                {
                    // "Show suggestions occasionally in Start".
                    new RegistryValue("SystemPaneSuggestionsEnabled", "REG_DWORD", "0"),
                    // The tips and "fun facts" overlaid on the lock screen. The Spotlight picture
                    // itself is a separate value and is left alone.
                    new RegistryValue("RotatingLockScreenOverlayEnabled", "REG_DWORD", "0"),
                    // Windows tips.
                    new RegistryValue("SoftLandingEnabled", "REG_DWORD", "0"),
                    // Suggested apps installed without being asked for.
                    new RegistryValue("SilentInstalledAppsEnabled", "REG_DWORD", "0"),
                },
                cmd,
                backup,
                requiresReboot: false,
                // Not a Policies branch: these are the values Windows itself writes for the
                // switches in Settings, so one that is absent is one this machine does not expose
                // and creating it would be writing a value nothing reads.
                requiresExistingValue: true
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
                    gameDvrCapture,
                    visualEffects,
                    transparency,
                    powerPlan,
                    copilotPolicy,
                    recall,
                    startupAds,
                    deliveryOptimization,
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
                    // What serves a game, applies on any machine, and does something Windows still
                    // acts on. Every entry is opt-in: this is the curated starting point, not a
                    // default. Its exact contents are pinned by
                    // TweakCatalogTests.CreateDefault_PinsTheCuratedSetsToADecisionSomeoneWroteDown,
                    // so an addition here is a decision someone has to write down.
                    //
                    // The omissions, each for its own reason. Visual Effects changes how Windows
                    // looks, which is not a side effect anyone clicking "gaming" is asking for. GPU
                    // Hardware Scheduling refuses to apply where the display driver never exposed
                    // `HwSchMode` — the common case — and a Preset is applied wholesale by the
                    // scheduler, so including it would make every headless `--task=gaming` run
                    // report failure on those machines. It stays individually selectable.
                    //
                    // E7 removed five more against primary sources (2026-08-20). The three BCD
                    // timers carry Microsoft's own note on `bcdedit /set`: "This option should only
                    // be used for debugging." `cpu.gamesTaskPriority` cancels itself — MMCSS
                    // documents `GPU Priority` as "not yet used" and treats `Priority` as 2 for any
                    // task whose Scheduling Category is High, which is the third value it writes.
                    // `network.tcpParameters` bundles stack settings no primary source ties to a
                    // gaming gain. All five stay in the catalog, individually selectable.
                    ["gaming"] = new[]
                    {
                        win32PrioritySeparation.Id,
                        systemResponsiveness.Id,
                        networkThrottling.Id,
                        fullscreenExclusive.Id,
                        gameMode.Id,
                        powerPlan.Id,
                        // Left `Recommended` in E7 but stays here: the stutter improvement is real
                        // on machines that see idle disk spikes and absent on the rest, and SysMain
                        // is a cache by design. A Preset the user opts into is the right home for a
                        // conditional gain; a box ticked for them is not.
                        sysMain.Id,
                        diagTrack.Id,
                        doSvc.Id,
                    },
                },
                // One click for someone who will not read the list: simple changes with honest gains
                // — fewer ads, less stutter, less needless background cost. Not "the gaming tweaks
                // that are safe enough to tick by default", which is how it was assembled and why
                // six of its eight entries did not survive the E7 evidence review (2026-08-20).
                // Nothing goes in without a primary source for the gain, on top of what the
                // constructor enforces (`Safe`, no restart) and the two judgement calls it cannot:
                // the power plan, which costs battery on a laptop, and forced fullscreen-exclusive,
                // which is a preference rather than a gain.
                //
                // E8 refilled it (2026-08-23). Each addition is a switch Windows itself exposes,
                // with a mechanism that can be named in one sentence and a cost the user can feel:
                // `windows.startupAds` removes advertising, `network.deliveryOptimization` stops
                // this PC uploading updates to strangers, `graphics.gameDvrCapture` stops a rolling
                // recording buffer nobody asked for, `system.transparency` stops the compositor
                // recomposing acrylic continuously. Every path was read on a live machine first.
                //
                // `windows.copilotPolicy` belongs here for a reason the other entries do not share:
                // it is the half of a removal that E4 cannot do. E4 uninstalls the Copilot Appx and
                // the taskbar entry and the Copilot key keep working, so the policy is the only
                // thing that actually turns the integration off. Someone who asked for Copilot to
                // be gone and got a half-removal is left in the state they were trying to leave.
                //
                // `windows.recall` is the one E8 entry that stayed out: it configures a feature
                // this project's target machine does not have. Membership would be legal — the
                // machine decides, not the catalog — but recommending it would say the catalog
                // stands behind something most users cannot use. It stays selectable.
                new[]
                {
                    gameMode.Id,
                    gameDvrCapture.Id,
                    transparency.Id,
                    startupAds.Id,
                    copilotPolicy.Id,
                    deliveryOptimization.Id,
                    diagTrack.Id,
                }
            );
        }
    }
}
