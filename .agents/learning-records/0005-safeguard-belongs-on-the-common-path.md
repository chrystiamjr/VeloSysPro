# A Safeguard Belongs on the Path That Always Runs

A guard placed where you *noticed* the problem protects only the situation you were looking at. `EnableProtection()` cleared Windows' once-per-day restore point cap and even carried a comment explaining why the app's promise is "a checkpoint per batch, not per day" — but it runs only when the user switches System Protection **on**. Every machine that already had protection enabled skipped it entirely and kept the cap, which is the common case, not the edge case. Before accepting a safeguard as done, ask which paths reach the thing being protected and whether the guard sits on all of them.

## Details & Context

The reasoning was correct and written down; only its placement was wrong. That is what made it survive review and a two-axis `/code-review` — the code *looked* like it handled the cap, because it said so.

**Before** — the cap was cleared on the setup path only:

```csharp
public void EnableProtection()          // runs only when protection was off
{
    // ...enable System Protection...
    _cmd.Run("reg.exe", "add ... /v SystemRestorePointCreationFrequency /d 0 /f");
}

public void CreateRestorePoint()        // runs on every batch — unguarded
{
    _cmd.Run("powershell.exe", "-Command \"Checkpoint-Computer ...\"");
}
```

**After** — extracted and moved onto the path that always runs:

```csharp
private bool LiftCreationFrequencyCap() => _cmd.Run("reg.exe", "add ... /d 0 /f").Success;

public void EnableProtection()   { /* ... */ LiftCreationFrequencyCap(); }
public void CreateRestorePoint() { LiftCreationFrequencyCap(); /* ...then verify... */ }
```

Two heuristics that would have caught it earlier:

1. **Name the paths that reach the protected operation, then check the guard against each.** Here: "protection was off and the user turned it on" versus "protection was already on". Only the first was covered, and it is the rarer one.
2. **A guard on a setup path protects a state transition, not an operation.** If the thing being protected happens repeatedly, the guard has to be adjacent to it, not to the one-time configuration that preceded it.

The consequence was not cosmetic: the app's Safety Checkpoint — the guarantee that every batch is undoable — was silently absent on any machine that had already taken an automatic restore point that day. The full diagnosis is in [`.local/docs/2026-08-20_20-00-39.elevation-checkpoint-feedback.md`](../../.local/docs/2026-08-20_20-00-39.elevation-checkpoint-feedback.md).

Related: [`absence-of-error-is-not-success.md`](file:///C:/Users/chrys/.agents/rules/absence-of-error-is-not-success.md) — the misplaced guard was only *discoverable* because the operation it failed to protect also reported success dishonestly. Fixing one without the other would have left the defect silent.
