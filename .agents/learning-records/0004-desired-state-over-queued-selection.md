# Desired State Over Queued Selection

A selection screen that mutates the system should express **the state the user wants**, not a queue
of commands to run. The checkbox means "I want this applied"; the list starts mirroring what the
host reports; the action bar submits the **difference**. Everything else on that screen fell out of
this one choice.

## Details & Context

The first version treated the checkbox as "include in the next run". It produced a screen that
contradicted itself: a Tweak badged **Applied** sat beside an **empty checkbox**, because the box
described a pending batch while the badge described the machine. Users read the two as one control.

Under desired state, three separate features stopped needing separate designs:

- **"Apply only when something changed"** is just "the drawn state differs from the live one".
- **"Revert everything"** is untick everything and apply. No dedicated control, no new Action.
- **Undo and redo in one gesture** works because the submitted difference has two directions.

That last one forced the seam to change: `applyTweaks` carries `{ tweakIds, revertIds }` and the
engine runs both under **one** Safety Checkpoint, reverting first so the batch ends in the state the
user drew regardless of click order. Splitting it would have meant two restore points around halves
of a single intention.

The model also makes the refresh rule precise, which had been wrong. The host re-emits the catalog
for three different reasons, and the screen must react differently to two of them: a plain read
reports the same applied set and must leave the drawn intent alone, while a batch that changed the
machine reports a different one and must replace the intent with reality. Comparing the **applied
set by value** — not the catalog object's identity — decides all cases with one rule, including a
batch that failed entirely (intent survives, the user retries) and a change made outside the app.

Because one click can now undo work, anything that reverts passes a dialog naming exactly what will
be undone. Not a courtesy: the user cannot make the decision without seeing the list, and
`window.confirm` cannot show one.

## Consequences & Trade-offs

**What this costs.** Three acceptance criteria written for the queued-selection model became wrong
rather than merely unimplemented, and were reconciled in the tickets instead of being implemented
literally or dropped in silence:

- "Keep user selection after a successful refresh" turned out to be a bug report, not a feature
  request — the first implementation reset intent on *every* re-emit, so unticking items and
  hitting Refresh silently restored them.
- "Clear all without applying or reverting anything" still holds — clearing mutates nothing — but
  clearing *and applying* is now how a user reverts everything, which is the feature that was
  wanted. The button's meaning changed underneath the sentence.
- "Advanced Tweaks unchecked on every initial catalog load" became "never ticked **unless the
  system already has it applied**". Forcing it unticked while it *is* applied would stage a revert
  nobody asked for.

**The transferable lesson.** When the interaction model changes, previously written acceptance
criteria are evidence about the old model, not instructions for the new one. Reconcile them in
writing, in the ticket, with the reason — implementing them literally reintroduces the contradiction
the new model exists to remove, and ignoring them silently leaves the next person to rediscover the
conflict.

**What it does not solve.** A `Partial` Tweak has no natural place on a two-state axis; it is
treated as not applied, with copy explaining why, and re-applying resolves it. If a future setting
needs a genuine third state, this model needs revisiting rather than stretching.
