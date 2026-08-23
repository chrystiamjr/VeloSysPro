---
sidebar_position: 1
---

# System Optimizations

VeloSys Pro offers both automated maintenance plans and an individually selectable, reversible **À-la-carte Tweaks** catalog to keep your operating system fast, responsive, and secure.

![VeloSys Pro optimization dashboard](/img/screenshots/dashboard.png)

## 1. À-la-carte Tweaks & Presets {#ala-carte-tweaks}

Choose optimizations individually or start from a curated Preset:
- **Gaming Preset**: A curated starting point you opt into — foreground scheduler priorities, multimedia network throttling, fullscreen behaviour, Windows Game Mode, the high-performance power plan, and three background services moved to Manual start. Every entry stays individually selectable and reversible.
- **Recommended**: One click for anyone who would rather not read the whole list — simple changes with honest gains: fewer ads, less needless background cost. Nothing that needs a restart, and nothing whose gain we cannot trace to a primary source.
- **Advanced Tier**: High-gain tweaks (e.g. Memory Integrity adjustments) requiring explicit confirmation of trade-offs.

### Safety Checkpoint & Measurement
Every tweak batch executes behind a **Safety Checkpoint**:
1. Creates a Windows System Restore point before touching settings.
2. Captures each tweak's previous registry/service value.
3. Applies selected tweaks and reverts unselected tweaks under the same transaction.
4. Takes an **Optimization Snapshot** (measuring boot time, free RAM, services, startup apps) and appends it to the append-only **Optimization History**.

---

## 2. Maintenance Plans {#maintenance-plans}

### Quick Optimization
A fast routine designed for daily maintenance:
- Flushes the Windows DNS Resolver cache (`ipconfig /flushdns`).
- Cleans temporary user files (`%TEMP%` and `%WINDIR%\Temp`).
- Empties system caches.

### Full Optimization
A comprehensive deep-cleaning and repair suite:
- Executes System File Checker (`sfc /scannow`) to detect and repair corrupted system files.
- Runs Deployment Image Servicing and Management (`DISM.exe /Online /Cleanup-Image /RestoreHealth`).
- Performs deep disk and update cache cleanup.

---

## 3. Maintenance & Recovery Tools {#tools}

- **Disk Health**: Generates a physical SMART disk status report.
- **Clear Update Cache**: Safely stops `wuauserv`, purges `SoftwareDistribution\Download`, and restarts the service.
- **Clean Prefetch**: Cleans `%WINDIR%\Prefetch` to rebuild application launch caches.
- **Revert Defaults**: Resets all network stack adjustments to default Windows configurations (`netsh int ip reset`, `netsh winsock reset`).

