---
title: Detect a Tweak's Intent, Never Literal Equality
keywords: ITweak, Detect, Apply, ServiceTweak, StartType, idempotence, hardened system, no-op, catalog growth
---

# Detect a Tweak's Intent, Never Literal Equality

## Overview

A Tweak names a target value, but it *exists* to achieve a goal. When detection compares the live
system to the named value for equality, a machine that already exceeds the goal reads as "not
applied" — and applying then moves it **away** from the goal while reporting a gain.

This was not hypothetical. `services.sysMain` is defined as "SysMain → `Manual`", to stop the
service starting on its own. On a real machine SysMain was already `Disabled`. Detection compared
`Disabled == Manual`, said not applied, and the batch ran `sc config SysMain start= demand` —
loosening a hardened service and listing it among the optimizations that had just been applied.
The capture recorded `"data": "Disabled"`, which is how it was found afterwards.

The impact was small (`Manual` rarely triggers) and it was fully revertible, but the direction was
backwards — and it multiplies. Every service the catalog adds follows the same "→ `Manual`" shape
(`DiagTrack`, `WSearch`, `DoSvc` are the obvious next ones), and the users who install an optimizer
are exactly the ones who have already hardened those services by hand.

## Strict Requirements

1. **Model the goal as an ordering, not a value.** Where a Tweak's setting has a natural "more or
   less of the thing we want" axis, encode that axis and compare along it. `ServiceTweak` ranks
   start types by how early the service may run (`Boot` 5 … `Disabled` 0) and treats anything at or
   below the target as satisfied.
2. **`Detect` returns `Applied` when the system already meets or exceeds the goal.** Never require
   the exact named value when a stricter one also achieves it.
3. **`Apply` is a no-op when the goal is already met.** Read the state from the `TweakCapture` the
   engine just took rather than querying again, and return success without issuing a command. A
   Tweak must never write a value that is a step backwards.
4. **`Revert` still restores the captured value exactly.** The ordering governs detection and
   application only. Undo is literal: whatever was captured goes back, including a value stricter
   than the Tweak's own target.
5. **State the axis in the catalog, not in the subtype's callers.** A new `ServiceTweak` inherits
   this for free; a new *kind* of Tweak with an ordered setting (a numeric threshold, a power plan,
   an enum of scheduling policies) must define its own comparison before shipping.
6. **Where no ordering exists, equality is correct.** A registry DWORD such as
   `Win32PrioritySeparation = 0x26` has no "even better" value; comparing numerically for equality
   (with hex/decimal normalization) is right. Do not invent an axis to satisfy this rule.

## Code & Architecture Examples

```csharp
// Requirement 1 — the axis, declared once, inherited by every ServiceTweak.
private static readonly Dictionary<string, int> Eagerness = new(StringComparer.OrdinalIgnoreCase)
{
    ["Boot"] = 5, ["System"] = 4, ["Automatic"] = 3,
    ["AutomaticDelayedStart"] = 2, ["Manual"] = 1, ["Disabled"] = 0,
};

// Requirement 2 — "quiet enough" is the question, not "equal".
private bool IsQuietEnough(string startType) =>
    Eagerness.TryGetValue(startType, out int actual)
    && Eagerness.TryGetValue(_desiredStartType, out int desired)
    && actual <= desired;

public TweakState Detect() =>
    IsQuietEnough(ReadStartType()) ? TweakState.Applied : TweakState.NotApplied;

// Requirement 3 — read the capture the engine already took; never downgrade.
public bool Apply(TweakCapture capture)
{
    string current = capture.Values.Count > 0 ? capture.Values[0].Data : Unknown;
    return IsQuietEnough(current) || Configure(_desiredStartType);
}
```

```csharp
// Requirement 6 — no axis here, so equality (numerically normalized) is the honest comparison.
private static bool SameData(string type, string actual, string desired) =>
    IsNumericType(type)
        ? TryParseNumber(actual, out ulong a) && TryParseNumber(desired, out ulong d) && a == d
        : string.Equals(actual, desired, StringComparison.OrdinalIgnoreCase);
```

## Verification Commands

```bash
dotnet test desktop.Tests/ --filter "FullyQualifiedName~ServiceTweakTests"
```

The guard must be falsifiable per [falsifiable-test-guards.md](./falsifiable-test-guards.md).
Narrow the comparison back to equality and confirm the suite fails before restoring it:

```bash
# in ServiceTweak.cs, change "actual <= desired" to "actual == desired"
dotnet test desktop.Tests/ --filter "FullyQualifiedName~ServiceTweakTests"   # MUST fail
```

Cover both directions for every ordered setting: a state quieter than the target reads as applied
and is left untouched, and a state noisier than the target is acted on.
