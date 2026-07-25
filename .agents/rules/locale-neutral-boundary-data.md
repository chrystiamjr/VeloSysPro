---
title: Locale-Neutral Data at Process & IPC Boundaries
keywords: locale, culture, schtasks, Get-ScheduledTask, ToString, sorting, badge, IPC, invariant
---

# Locale-Neutral Data at Process & IPC Boundaries

## Overview

Values that cross a boundary — native Windows process → C# host, or C# host → React frontend —
must be **locale-neutral when any logic depends on them**. Formatting for humans belongs at the
edge that renders, never at the edge that produces.

This is distinct from [windows-process-boundary.md](./windows-process-boundary.md), which governs
byte-level concerns (OEM encoding, stdout/stderr separation, exit codes). A string can decode
perfectly and still be unusable because its **content** was localized or culture-formatted.

Two real defects in VeloSys Pro came from violating this:

1. `SchedulerManager.GetTasksJson` read the status column of `schtasks /query /fo CSV /nh`. Windows
   translates that column to the display language, so the same build showed `Pronto` on a pt-BR
   machine and `Ready` on an en-US one. The value could not be mapped to a `Badge` variant or an
   i18n key, and the UI ended up rendering raw OS text that ignored the app's own language setting.
2. `BackupManager` sends sizes via `ToString("N1")` and dates pre-formatted as `dd/MM/yyyy HH:mm`.
   Sorting those strings in the frontend is wrong in both directions: `parseFloat("1.234,5")`
   returns `1.234`, and lexicographically `31/12/2025 23:00` sorts *after* `01/01/2026 00:00`.

## Strict Requirements

1. **Prefer structured cmdlets over CLI text** when a value drives logic. Query PowerShell cmdlets
   that return .NET types (`Get-ScheduledTask` → `State` enum, `Get-ComputerRestorePoint`) instead
   of parsing the console output of a legacy tool whose columns Windows localizes.
2. **Never map localized OS text to UI state.** Badge variants, i18n keys, enum switches and
   conditionals must key off a stable token (a .NET enum name, an invariant identifier), never off
   text the OS translated.
3. **Keep a fallback when swapping a query path.** A structured query that fails must degrade to the
   previous parser rather than emptying the list. Keep the old parser and its tests.
4. **Emit invariant primitives for anything sortable or comparable.** If the host must send display
   text, the frontend needs a parser that handles every culture it can arrive in — grouped
   thousands with either separator, and `dd/MM/yyyy`. Put it in `frontend/src/domain/formatters.ts` and unit
   test the cross-culture and cross-year cases, not just the happy path.
5. **Use `CultureInfo.InvariantCulture` explicitly** for any C# value parsed or compared downstream
   (`int.TryParse`, `ToString` of identifiers), so machine culture cannot change the payload.
6. **Whitelist before interpolating.** Values reaching a command line must be validated against an
   explicit allowlist or regex, never merely defaulted.

## Code & Architecture Examples

```csharp
// WRONG — cols[2] is the status column, translated to the Windows display language.
string csv = _cmd.RunCapture("schtasks.exe", "/query /fo CSV /nh");
list.Add(new TaskInfo(name, cols[2], fullPath));

// RIGHT — $_.State is a .NET enum: Ready/Running/Disabled regardless of OS language.
const string ps =
    "Get-ScheduledTask -TaskPath '\\' | "
    + "Where-Object { $_.TaskName -like 'VeloSysPro_*' } | "
    + "ForEach-Object { [PSCustomObject]@{ "
    + "Name = $_.TaskName; State = [string]$_.State; "
    + "Path = $_.TaskPath + $_.TaskName } } | ConvertTo-Json -Compress";

string raw = _cmd.RunCapture("powershell.exe", "-ExecutionPolicy Bypass -Command \"" + ps + "\"").Trim();
if (raw.StartsWith("[", StringComparison.Ordinal)) return raw;
// ConvertTo-Json emits an object, not an array, for a single item.
if (raw.StartsWith("{", StringComparison.Ordinal)) return "[" + raw + "]";
return GetTasksJsonFromSchtasks(); // requirement 3: fallback, never an empty list
```

```typescript
// A separator trailed by at most two digits is the decimal separator; the rest group thousands.
// Handles "1,234.5 KB" (en-US) and "1.234,5 KB" (pt-BR) identically.
export function parseDisplayNumber(value: string): number {
  const raw = (value ?? '').replace(/[^\d.,]/g, '');
  if (raw.length === 0) return 0;

  const lastSeparator = Math.max(raw.lastIndexOf('.'), raw.lastIndexOf(','));
  const isDecimal = lastSeparator >= 0 && raw.length - lastSeparator - 1 <= 2;
  const decimals = isDecimal ? raw.slice(lastSeparator + 1) : '';
  const integer = (isDecimal ? raw.slice(0, lastSeparator) : raw).replace(/[.,]/g, '');

  const parsed = Number(decimals ? `${integer}.${decimals}` : integer);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Map the stable enum name, never the localized OS string.
const STATE_LABELS: Record<string, { key: string; variant: BadgeVariant }> = {
  ready: { key: 'scheduling.stateReady', variant: 'success' },
  running: { key: 'scheduling.stateRunning', variant: 'warning' },
  disabled: { key: 'scheduling.stateDisabled', variant: 'danger' },
};
```

## Verification Commands

```bash
npm run validate
dotnet build desktop/VeloSysPro.csproj
dotnet test desktop.Tests/
```

Assert the query itself, not just its mocked output — see
[falsifiable-test-guards.md](./falsifiable-test-guards.md). A test that only feeds canned output
back through `RunCapture` cannot detect that the wrong column, or a localized one, is being read.
