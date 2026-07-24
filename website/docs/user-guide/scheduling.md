---
sidebar_position: 4
---

# Automated Scheduling & CLI

VeloSys Pro can run headlessly in the background via command line flags or scheduled Windows tasks.

## Command Line Usage {#command-line-usage}

Execute tasks directly from Command Prompt or PowerShell:

```powershell
.\VeloSysPro.exe --task=quick
.\VeloSysPro.exe --task=full
.\VeloSysPro.exe --task=gaming
.\VeloSysPro.exe --task=revert
```

When called with `--task=<mode>`, VeloSys Pro runs headlessly without opening the WebView2 UI, appends logs to `%LOCALAPPDATA%\VeloSysPro\logs`, and exits with code `0` on success or non-zero on error.

## Windows Task Scheduler Integration {#windows-task-scheduler-integration}

From the **Scheduling** tab in the UI:
- Set daily or weekly optimization triggers.
- VeloSys Pro registers native Windows Scheduled Tasks that execute `VeloSysPro.exe --task=...` automatically.
