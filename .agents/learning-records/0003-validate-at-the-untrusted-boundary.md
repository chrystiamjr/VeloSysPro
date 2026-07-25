# Validate at the Untrusted Boundary, Not at the Constrained Form

Runtime validation belongs where data is **untrusted**, not where the UI has already constrained
it by construction. Asked whether to adopt Zod and React Hook Form together, the answer was Zod
alone and on the IPC bridge: the app's only form offers closed sets with nothing to validate,
while every payload arriving from the C# host was cast unchecked. This is the criterion to apply
next time the question is "where do we validate this?".

## Details & Context

**The proposal.** Introduce Zod *and* React Hook Form while reworking the scheduling form.

**Why React Hook Form was declined.** Auditing the actual surface:

- The only form in the app is `SchedulingPage`'s, and every field is a closed set — a `<select>`
  cannot produce an invalid value.
- There are **no free-text inputs anywhere**: 5 controls in `SchedulingPage` plus one checkbox in
  `SettingsPage`.
- No cross-field rules beyond conditional rendering, no async validation, no dirty/touched UX, no
  field arrays, no error messages to render.
- The new `DayOfMonthPicker` is a custom control, which in RHF means wrapping it in `Controller` —
  *more* indirection than the `useState` it would replace.

RHF would have added a dependency, a resolver and a schema with no rule that could actually fail.
`AGENTS.md` mandates YAGNI explicitly.

**Where the real gap was.** `src/infrastructure/bridge.ts` did this on five channels:

```ts
const data: ScheduledTaskItem[] = typeof tasksJson === 'string' ? JSON.parse(tasksJson) : tasksJson;
```

`JSON.parse` returns `any` and TypeScript types are erased at runtime, so the annotation is a
promise the compiler cannot keep. The host serializes its own records and injects them via
`EvalJs`. The only guard in the whole file was `info && info.version`. A shape change on the C#
side surfaced as a blank or wrong table with **no diagnostic** — the failure class
`fullstack-sync.md` exists to prevent, and one this codebase had already hit twice (the localized
`State` column, the culture-formatted sizes).

**The criterion, stated generally.** Validate where you cannot control the producer. A `<select>`
whose options you rendered is not such a place; a payload another process serialized is. Outbound
data going the other way is already whitelisted in C# before it reaches a command line, which is
the same principle applied at the other end.

**Cost accepted.** One dependency (`zod`), and the schemas become the source of truth with the
interfaces in `types.ts` inferred via `z.infer`, so a schema and its type cannot drift.

**Revisit RHF when** a form appears with free text, cross-field rules, async validation, or real
error-state UX. The decision was about this form, not about the library.

## Related

- [falsifiable-test-guards.md](../rules/falsifiable-test-guards.md) — per-field probing, which
  caught four fields whose schema types were never actually asserted.
- [fullstack-sync.md](../rules/fullstack-sync.md) — the cross-layer drift this guards against.
- PR #28.
