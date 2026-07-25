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
A named VeloSys Pro recipe that applies quick, full, gaming, or revert system changes.
_Avoid_: Maintenance Action, individual Windows command
