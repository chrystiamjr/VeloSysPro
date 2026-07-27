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
    /// Presets are keyed by the headless CLI task names (<c>quick</c>, <c>gaming</c>) so the
    /// scheduled <c>VeloSysPro.exe --task=…</c> entries keep working while the UI moves from fixed
    /// Optimization Plans to an à-la-carte selection (docs/adr/0003-tweak-as-reversible-unit.md).
    /// </remarks>
    public sealed class TweakCatalog
    {
        private readonly Dictionary<string, ITweak> _byId;

        public TweakCatalog(
            IReadOnlyList<ITweak> tweaks,
            IReadOnlyDictionary<string, IReadOnlyList<string>> presets
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

            Tweaks = tweaks;
            Presets = presets.Select(preset => new Preset(preset.Key, preset.Value)).ToList();
        }

        public IReadOnlyList<ITweak> Tweaks { get; }

        public IReadOnlyList<Preset> Presets { get; }

        public ITweak? Find(string id) => _byId.TryGetValue(id, out ITweak? tweak) ? tweak : null;

        /// <summary>
        /// The shipped catalog. E0 seeds one Tweak per revert mechanism — a registry value, a BCD
        /// element, and a service start type — so the whole detect/apply/revert loop is proven
        /// before the catalog grows breadth.
        /// </summary>
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

            var disableDynamicTick = new BcdTweak(
                "boot.disableDynamicTick",
                TweakCategories.Boot,
                RiskTier.Safe,
                "disabledynamictick",
                "yes",
                cmd
            );

            var sysMain = new ServiceTweak(
                "services.sysMain",
                TweakCategories.Services,
                RiskTier.Safe,
                "SysMain",
                "Manual",
                cmd
            );

            return new TweakCatalog(
                new ITweak[] { win32PrioritySeparation, disableDynamicTick, sysMain },
                new Dictionary<string, IReadOnlyList<string>>
                {
                    ["quick"] = new[]
                    {
                        win32PrioritySeparation.Id,
                        disableDynamicTick.Id,
                        sysMain.Id,
                    },
                }
            );
        }
    }
}
