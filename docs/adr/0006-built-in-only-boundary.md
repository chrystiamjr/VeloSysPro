# Replicate Effects With Built-In Facilities, Never Bundle External Tools

VeloSys Pro will perform every optimization and measurement using **only built-in Windows facilities** — the registry, `bcdedit`, `sc`, `powercfg`, `Get-`/`Remove-AppxPackage`, WMI/CIM, and the Windows event log. It will never download, bundle, or launch third-party software. Where a popular tool's benefit comes from a registry effect, VeloSys replicates the **effect** directly rather than invoking the tool.

## Considered Options

- Bundle or shell out to the established tools (RivaTuner, ISLC, O&O ShutUp10, winutil).
- Replicate only the effects that built-in facilities can produce.

## Consequences

Gains that exist only inside an external tool — frame limiting via RTSS, standby-list cleaning via ISLC — are simply not offered. The Optimization Snapshot measures boot duration, memory, disk, service counts, startup entries, and pending-reboot state through CIM and the Diagnostics-Performance log instead of a benchmark. The single-executable deliverable stays clean and the project takes on no supply-chain or support risk from someone else's installer.
