---
title: Falsifiable Test Guards
keywords: testing, vacuous test, shell-out, assert command, injected regression, fake, i18n parity, per-field probe, StrictMode
---

# Falsifiable Test Guards

## Overview

A test that cannot fail is worse than no test: it reports coverage that does not exist. Two shapes
of vacuous test appeared in VeloSys Pro and both survived a full green suite.

1. **Asserting the mock instead of the code.** `SchedulerManager.GetTasksJson` was rewritten to run a
   PowerShell query, but every test only set `FakeCommandRunner.CapturedOutput` and asserted the
   parsed result. The command string itself was never asserted, so a typo anywhere in the script —
   a wrong column, a missing `[string]` cast, unbalanced quotes — would have passed all 38 tests.
2. **Asserting a shallower invariant than the one that matters.** The i18n test compared
   `Object.keys()` at the **top level only**. Nested additions (`scheduling.weekday.*`,
   `settings.update*`, `table.*`) could exist in one locale and be missing from the other, silently
   rendering the raw key at runtime. Two pt-BR strings (`nav.restorePoints`, `act.restorePoint.title`)
   had in fact sat untranslated in English while the test stayed green.

## Strict Requirements

1. **Assert the command, not only its canned output.** For any manager that shells out
   (`ICommandRunner.Run` / `RunCapture`), assert the executable and the argument string: the tool
   invoked, the flags, the fields selected, and quote balance for anything passed via
   `-Command`/`-c`. `RunCapture` records into `FakeCommandRunner.Runs` — use it.
2. **Prove a new guard can fail.** Before considering a guard done, inject the regression it claims
   to catch, confirm the test fails, then revert. State in the PR that this was done. A guard added
   without this step is unverified.
3. **Drive multi-tool code paths independently.** When a manager queries more than one executable
   (a preferred path plus a fallback), a single canned output makes the fallback pass by coincidence.
   Use `FakeCommandRunner.CapturedOutputs` keyed by exe, and assert the **order and count** of calls
   so "preferred path succeeded" is distinguishable from "fell through".
4. **Match the invariant's real depth.** Structural guards must cover the whole structure: compare
   flattened key paths, not top-level keys; assert interpolation placeholders match across locales;
   flag values byte-identical between languages as suspected untranslated leaks.
5. **Scope assertions so shared text cannot satisfy them.** A page-level `getByText` can match a
   `<option>` in a form as well as the table cell under test. Scope with `within(...)`, or use exact
   matching so an ancestor's concatenated `textContent` does not count as a hit.
6. **Cover the edges that silently degrade.** Empty and whitespace-only tool output, malformed
   values, `initialSort` naming a column that does not exist or is not sortable, and callers'
   arrays not being mutated.
7. **Probe a composite guard field by field, not as a whole.** Relaxing one field of a schema and
   re-running is the only way to learn which fields are actually load-bearing. Applying
   requirement 2 to a Zod schema as a unit passes trivially: a payload missing several fields is
   still rejected when any single one is relaxed.
8. **A "field missing" case does not test that field's type.** `z.any()` accepts `undefined`, so a
   fixture that omits the field still parses once the field is relaxed. Every field needs a
   **wrong-type** case; keep the missing case too, but only as a requiredness check. Four fields
   in the first draft of the bridge tests (`Size`, `Description`, `Path`, `url`) looked covered and
   were not.
9. **Never assert an absolute count of dispatched actions.** `React.StrictMode`
   (`frontend/src/main.tsx`) double-invokes effects in development, so every bootstrap dispatch happens
   twice locally and once in production. Capture the count before the interaction and assert the
   **delta**.

## Code & Architecture Examples

```csharp
// Requirement 1 — the query itself is the thing under test.
[Fact]
public void GetTasksJson_QueriesPowerShellForTheLiveTaskState()
{
    var runner = new FakeCommandRunner { CapturedOutput = "[]" };
    var scheduler = new SchedulerManager(runner, new RecordingStatusSink(), "VeloSysPro.exe");

    scheduler.GetTasksJson();

    var (exe, args) = Assert.Single(runner.Runs);
    Assert.Equal("powershell.exe", exe);
    Assert.Contains("Get-ScheduledTask", args);
    Assert.Contains("State = [string]$_.State", args);   // the localization fix itself
    Assert.Contains("$_.TaskName -like 'VeloSysPro_*'", args);
    Assert.Equal(0, args.Count(c => c == '"') % 2);      // -Command payload stays parseable
}

// Requirement 3 — preferred path and fallback driven independently.
var runner = new FakeCommandRunner();
runner.CapturedOutputs["powershell.exe"] = "";           // yields nothing
runner.CapturedOutputs["schtasks.exe"] = "\"\\VeloSysPro_Quick_Daily_0300\",\"N/A\",\"Ready\"";

Assert.Collection(
    runner.Runs,
    first => Assert.Equal("powershell.exe", first.Exe),
    second => Assert.Equal("schtasks.exe", second.Exe)
);
```

```typescript
// Requirement 4 — compare the whole structure, not its first level.
function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value as Record<string, unknown>, path));
    } else {
      out[path] = String(value);
    }
  }
  return out;
}

expect(Object.keys(flatten(pt_BR)).sort()).toEqual(Object.keys(flatten(en_US)).sort());
```

```typescript
// Requirement 8 — the wrong-type case is what makes the field load-bearing; the missing case
// only proves it is required. A suite with the second but not the first looks covered.
it.each([
  ['Size as a number', { ...validBackup, Size: 43520 }], // fails if Size becomes z.any()
  ['Size missing', { Name: 'backup.reg', Date: '24/07/2026 10:30' }], // passes either way
])('rejects a backup with %s', (_label, backup) => {
  subscribeBackups(callback);
  window.onBackupsLoaded!([backup] as never);
  expect(callback).toHaveBeenCalledWith([]);
});
```

```typescript
// Requirement 9 — deltas, because StrictMode doubles the bootstrap dispatches in dev.
cy.get<Sinon.SinonStub>('@ipcStub').then((stub) => {
  const before = countOf(stub, 'getTasks');
  cy.getByCy('nav-Scheduling').click();
  cy.get<Sinon.SinonStub>('@ipcStub').should((after) => {
    expect(countOf(after, 'getTasks')).to.be.greaterThan(before);
  });
});
```

## Verification Commands

```bash
npm run validate
dotnet test desktop.Tests/
```

To satisfy requirement 2, back up the target, inject the regression, confirm the failure, restore:

```bash
# Example: prove the PowerShell query assertion is not vacuous.
cp desktop/Features/Scheduling/SchedulerManager.cs "$TEMP/sched.bak.cs"
sed -i 's/State = \[string\]\$_\.State; /State = $_.State; /' desktop/Features/Scheduling/SchedulerManager.cs
dotnet test desktop.Tests/ 2>&1 | grep -E "Com falha|Failed"   # MUST report a failure
cp "$TEMP/sched.bak.cs" desktop/Features/Scheduling/SchedulerManager.cs
git diff --stat desktop/Features/Scheduling/SchedulerManager.cs # MUST be empty
```

For requirements 7 and 8, loop the probe over every field and treat "no failure" as a gap:

```bash
cp frontend/src/domain/schemas.ts "$TEMP/schemas.bak.ts"
for pat in "Name: z.string()" "Size: z.string()" "State: z.string()" "url: z.string()"; do
  key="${pat%%:*}"
  node -e "const fs=require('fs'),p='frontend/src/domain/schemas.ts';const s=fs.readFileSync(p,'utf8');
    const old='  '+process.argv[1]+',';
    if(!s.includes(old)){console.error('PATTERN NOT FOUND');process.exit(1);}
    fs.writeFileSync(p,s.replace(old,'  '+process.argv[2]+': z.any(),'));" "$pat" "$key" || continue
  npm exec --workspace frontend vitest run tests/unit/infrastructure/bridge.test.ts 2>&1 | grep -qE "[0-9]+ failed" \
    && echo "$key covered" || echo "$key *** NO COVERAGE ***"
  cp "$TEMP/schemas.bak.ts" frontend/src/domain/schemas.ts
done
```

Assert the substitution actually applied before trusting the result. A scripted edit that silently
no-ops reports every field as covered — this happened with `python`, which resolves to the
Microsoft Store alias stub on this machine; use `node -e` instead.
