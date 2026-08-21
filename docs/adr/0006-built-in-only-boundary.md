# Replicate Effects With Built-In Facilities, Never Bundle External Tools

VeloSys Pro will perform every optimization and measurement using **only built-in Windows facilities** — the registry, `bcdedit`, `sc`, `powercfg`, `Get-`/`Remove-AppxPackage`, WMI/CIM, and the Windows event log. It will never download, bundle, or launch third-party software. Where a popular tool's benefit comes from a registry effect, VeloSys replicates the **effect** directly rather than invoking the tool.

## Considered Options

- Bundle or shell out to the established tools (RivaTuner, ISLC, O&O ShutUp10, winutil).
- Replicate only the effects that built-in facilities can produce.

## Consequences

Gains that exist only inside an external tool — frame limiting via RTSS, standby-list cleaning via ISLC — are simply not offered. The Optimization Snapshot measures boot duration, memory, disk, service counts, startup entries, and pending-reboot state through CIM and the Diagnostics-Performance log instead of a benchmark.

That choice bounds what a before/after pair can honestly claim, and the UI has to respect it. Boot duration comes from the event log for the *last* boot, so it cannot move until the machine restarts; each Snapshot therefore carries the boot it belongs to, and a pair from one session says "restart to measure" rather than reporting an unchanged figure as no gain. Free memory and free disk drift on their own between two readings taken a minute apart and no Tweak touches them, so they are captured for the history but kept out of the comparison. What a batch can be held to is the settings it actually moved, read back off the live system after applying — that half is fully attributable and is shown separately.

The single-executable deliverable stays clean and the project takes on no supply-chain or support risk from someone else's installer.
