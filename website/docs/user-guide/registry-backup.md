---
sidebar_position: 2
---

# Registry Backup & Restore

Before applying network or system tweaks, VeloSys Pro provides built-in tools for registry safety.

![Registry Backup and Restore screen](/img/screenshots/backup.png)

## Creating a Registry Backup {#creating-a-registry-backup}

1. Navigate to the **Registry Backup** tab in VeloSys Pro.
2. Click **Create Backup**.
3. A `.reg` snapshot of your current TCP/IP and network configuration will be exported and timestamped in your `%LOCALAPPDATA%\VeloSysPro\backups` directory.

## Restoring a Backup {#restoring-a-backup}

1. Select a backup entry from the table list.
2. Click **Restore Backup** and confirm the dialog.
3. VeloSys Pro imports the selected `.reg` file into the Windows Registry.
