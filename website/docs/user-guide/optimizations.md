---
sidebar_position: 1
---

# System Optimizations

VeloSys Pro offers tailored optimization profiles to keep your operating system fast and responsive.

![VeloSys Pro optimization dashboard](/img/screenshots/dashboard.png)

## Quick Optimization {#quick-optimization}
A fast routine designed for daily maintenance:
- Flushes the Windows DNS Resolver cache (`ipconfig /flushdns`).
- Cleans temporary user files (`%TEMP%` and `%WINDIR%\Temp`).
- Empties system caches.

## Full Optimization {#full-optimization}
A comprehensive deep-cleaning and repair suite:
- Executes System File Checker (`sfc /scannow`) to detect and repair corrupted system files.
- Runs Deployment Image Servicing and Management (`DISM.exe /Online /Cleanup-Image /RestoreHealth`).
- Performs deep disk and update cache cleanup.

## Gaming Mode {#gaming-mode}
Optimizes network responsiveness for online gaming:
- Enables Receive-Side Scaling (RSS) on network adapters.
- Sets TCP Window Auto-Tuning level to `normal`.
- Enables Explicit Congestion Notification (ECN) to reduce latency spikes.

## Revert Defaults {#revert-defaults}
Resets all network stack adjustments to default Windows configurations (`netsh int ip reset`, `netsh winsock reset`).
