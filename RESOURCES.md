# VeloSys Pro Resources & Codebase Anchors

Key reference points and primary codebase entry points for VeloSys Pro.

## Core Codebase Anchors

- [WPF WebView2 Host](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/desktop/MainWindow.xaml.cs)
  Primary C# host window handling WebView2 initialization and native system commands.
- [IPC Bridge Infrastructure](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/frontend/src/infrastructure/bridge.ts)
  Frontend IPC communication layer and test mock definitions.
- [Tailwind Design System Tokens](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/frontend/tailwind.config.js)
  Single source of truth for color palette, spacing, typography, and theme tokens.
- [Project Guidelines & Architecture](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/AGENTS.md)
  Main architecture rules, clean code standards, and learned rules index.
- [Shared DataTable Organism](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/frontend/src/components/organisms/DataTable.tsx)
  The single sortable/paginated table for every management screen. Add columns here, never per page.
- [Scheduling Domain Module](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/frontend/src/domain/scheduling.ts)
  Task-name encoding/decoding, frequency and weekday constants, and task-state to badge mapping.
- [Display Value Formatters](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/frontend/src/domain/formatters.ts)
  Culture-tolerant parsers turning host display strings back into sortable primitives.
- [Scheduler Host Manager](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/desktop/Features/Scheduling/SchedulerManager.cs)
  `schtasks` creation/deletion plus the `Get-ScheduledTask` listing with its CSV fallback.

- [Inbound Payload Schemas](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/frontend/src/domain/schemas.ts)
  Zod definitions for every shape the C# host sends; `types.ts` infers its interfaces from these.
- [Select Atom](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/frontend/src/components/atoms/Select.tsx)
  Shared field styling plus the inset custom chevron. Exports `fieldClass` for native inputs that must match.
- [Tweak Contract](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/desktop/Features/Tweaks/ITweak.cs)
  `ITweak`, `TweakState`, `RiskTier`, `TweakCapture`, `TweakChange`. Start here to add an optimization; the three subtypes beside it cover the registry, BCD, and service revert mechanisms.
- [Tweak Catalog](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/desktop/Features/Tweaks/TweakCatalog.cs)
  Every shipped Tweak, the Presets over them, and the recommended set. Rejects at construction any Preset or recommendation naming an `Advanced` Tweak.
- [Tweak Engine](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/desktop/Features/Tweaks/TweakEngine.cs)
  Safety Checkpoint, per-Tweak capture, apply and revert in one batch, and the before/after measurement. Returns facts; `ActionHost` publishes them.
- [Optimize Selection Screen](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/frontend/src/components/pages/OptimizePage.tsx)
  The desired-state model: boxes mirror the host, the action bar submits the difference. See learning record 0004 before changing how selection behaves.

## External References

- [Get-ScheduledTask (ScheduledTasks module)](https://learn.microsoft.com/powershell/module/scheduledtasks/get-scheduledtask)
  Authoritative shape of the returned object; `State` is a locale-independent enum.
- [schtasks.exe reference](https://learn.microsoft.com/windows-server/administration/windows-commands/schtasks)
  `/sc`, `/d`, `/st`, `/rl` semantics — note `/d` takes MON..SUN for WEEKLY and 1..31 for MONTHLY.
- [MDN: color-scheme](https://developer.mozilla.org/docs/Web/CSS/color-scheme)
  Why native controls in WebView2 render light until the page declares its scheme.
