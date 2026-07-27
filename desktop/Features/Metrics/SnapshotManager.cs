using System;
using System.Globalization;
using System.Text.Json;

namespace VeloSysPro
{
    /// <summary>
    /// Captures an Optimization Snapshot from built-in Windows facilities only — CIM, the service
    /// controller, and the Diagnostics-Performance event log (docs/adr/0006-built-in-only-boundary.md).
    /// </summary>
    /// <remarks>
    /// One PowerShell round trip produces every metric as JSON, so a Snapshot costs a single process
    /// instead of six. Everything read is a number or a .NET enum name: nothing here may depend on
    /// the Windows display language, because the frontend renders and compares these values.
    /// </remarks>
    public sealed class SnapshotManager
    {
        /// <summary>Shape of the JSON the query emits; deserialized then stamped with the capture time.</summary>
        private sealed record Metrics(
            long BootDurationMs,
            long FreeMemoryBytes,
            long TotalMemoryBytes,
            long FreeDiskBytes,
            long TotalDiskBytes,
            int AutomaticServices,
            int RunningServices,
            int StartupApps,
            bool PendingReboot,
            string? LastBootUpTime
        );

        /// <summary>
        /// Single-quoted throughout: the whole script is passed inside one -Command "…" pair, so a
        /// double quote anywhere in here would truncate the command at the process boundary.
        /// </summary>
        private const string Query =
            "$ErrorActionPreference='SilentlyContinue';"
            + "$os=Get-CimInstance Win32_OperatingSystem;"
            + "$disk=Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DeviceID -eq $env:SystemDrive } | Select-Object -First 1;"
            + "$svc=Get-Service;"
            + "$boot=0;"
            + "$evt=Get-WinEvent -LogName 'Microsoft-Windows-Diagnostics-Performance/Operational' -FilterXPath '*[System[EventID=100]]' -MaxEvents 1;"
            + "if ($evt) { $data=([xml]$evt.ToXml()).Event.EventData.Data | Where-Object { $_.Name -eq 'BootTime' }; if ($data) { $boot=[int64]$data.'#text' } };"
            + "[PSCustomObject]@{"
            + "bootDurationMs=$boot;"
            + "freeMemoryBytes=[int64]$os.FreePhysicalMemory*1024;"
            + "totalMemoryBytes=[int64]$os.TotalVisibleMemorySize*1024;"
            + "freeDiskBytes=[int64]$disk.FreeSpace;"
            + "totalDiskBytes=[int64]$disk.Size;"
            + "automaticServices=@($svc | Where-Object { [string]$_.StartType -eq 'Automatic' }).Count;"
            + "runningServices=@($svc | Where-Object { [string]$_.Status -eq 'Running' }).Count;"
            + "startupApps=@(Get-CimInstance Win32_StartupCommand).Count;"
            + "pendingReboot=[bool](Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending');"
            + "lastBootUpTime=$os.LastBootUpTime.ToUniversalTime().ToString('o')"
            + "} | ConvertTo-Json -Compress";

        private static readonly JsonSerializerOptions Options = new()
        {
            PropertyNameCaseInsensitive = true,
        };

        private readonly ICommandRunner _cmd;
        private readonly IStatusSink _sink;

        public SnapshotManager(ICommandRunner cmd, IStatusSink sink)
        {
            _cmd = cmd;
            _sink = sink;
        }

        public OptimizationSnapshot Capture()
        {
            string capturedAt = TweakClock.NowUtc();
            Metrics? metrics = ReadMetrics();

            if (metrics == null)
            {
                _sink.Log("log.snapshot.unavailable", "info");
                return new OptimizationSnapshot(capturedAt, 0, 0, 0, 0, 0, 0, 0, 0, false, "");
            }

            return new OptimizationSnapshot(
                capturedAt,
                metrics.BootDurationMs,
                metrics.FreeMemoryBytes,
                metrics.TotalMemoryBytes,
                metrics.FreeDiskBytes,
                metrics.TotalDiskBytes,
                metrics.AutomaticServices,
                metrics.RunningServices,
                metrics.StartupApps,
                metrics.PendingReboot,
                metrics.LastBootUpTime ?? ""
            );
        }

        private Metrics? ReadMetrics()
        {
            CaptureResult query = _cmd.RunCapture(
                "powershell.exe",
                "-ExecutionPolicy Bypass -Command \"" + Query + "\""
            );
            if (!query.Success) return null;

            try
            {
                return JsonSerializer.Deserialize<Metrics>(query.Output.Trim(), Options);
            }
            catch
            {
                return null;
            }
        }
    }
}
