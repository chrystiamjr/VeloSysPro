# Build a Safety Checkpoint Before Any Batch

Before applying a batch of Tweaks the host will build a **Safety Checkpoint**: a Windows System Restore Point plus a **per-Tweak capture** of the exact prior state (registry values and an exported `.reg` archive of the key, a service's `StartType`, a BCD element's value). The restore point is the coarse, system-wide recovery that survives even a boot-blocking mistake; the per-Tweak capture is what powers granular in-app Revert without a reboot.

## Considered Options

- Restore point only.
- Per-Tweak capture only.
- Both, as one checkpoint.

## Consequences

`RegistryBackupManager` widens beyond its TCP/IP-only export to arbitrary named keys and gains `ImportKey`, becoming the registry archive store; captures live under `%LOCALAPPDATA%\VeloSysPro\captures` via `ITweakCaptureStore`. A Tweak reverts from its recorded values rather than by re-importing the whole-key archive, because a key such as the MMCSS `SystemProfile` holds values owned by several Tweaks and a whole-key import would undo the others too; the archive remains the fallback when a capture's values cannot be read. The existing safety-backup preference is honored, and a restore point that cannot be created stops the batch rather than silently proceeding without a safety net.
