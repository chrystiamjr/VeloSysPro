# VeloSys Pro

VeloSys Pro coordinates user intentions and host-reported facts while optimizing and maintaining a Windows system.

## Language

**Action**:
An intention sent by the user interface for the Windows host to perform or answer.
_Avoid_: Command, request, message

**Event**:
A fact emitted by the Windows host for the user interface to observe.
_Avoid_: Callback, response, message

**Management Record**:
A host-reported description of one scheduled task, registry backup, or system restore point.
_Avoid_: Display row, formatted payload

**Registry Backup**:
An exported copy of the Windows Registry network settings managed by VeloSys Pro.
_Avoid_: Restore point, generic backup

**System Restore Point**:
A Windows-managed snapshot used to return the system to an earlier state.
_Avoid_: Registry backup, file backup

**Optimization Plan**:
A named VeloSys Pro maintenance recipe — quick cleanup, full repair, or network revert. Owns no Tweaks and takes no capture. Superseded for anything that changes a persistent setting by **Preset**.
_Avoid_: Maintenance Action, individual Windows command

**Tweak**:
An individually selectable optimization that knows how to detect, apply, and revert itself.
_Avoid_: Setting, fix, hack

**Preset**:
A named, curated selection of Tweaks the user can adjust before applying.
_Avoid_: Profile, template

**Risk Tier**:
A Tweak's safety classification — `Safe` or `Advanced` — that governs whether it is selected by default and whether applying it requires confirmation.
_Avoid_: Severity, level

**Tweak State**:
The result of detecting a Tweak against the live system: `Applied`, `NotApplied`, or `Partial`.
_Avoid_: Status, condition

**Safety Checkpoint**:
The pre-batch safety bundle: a System Restore Point plus the captured prior state of every Tweak being applied.
_Avoid_: Backup, snapshot

**Optimization Snapshot**:
A timestamped set of internal system metrics captured before and after a batch to show the gain.
_Avoid_: Benchmark, report

**Optimization History**:
The persisted series of Optimization Snapshots over time.
_Avoid_: Log, audit trail

**Snapshot Store**:
The storage seam that persists and reads back Optimization Snapshots.
_Avoid_: Database, repository

**Debloat**:
Curated removal of allow-listed Appx packages; unlike a Tweak, it is not cleanly reversible in-app.
_Avoid_: Uninstall, cleanup
