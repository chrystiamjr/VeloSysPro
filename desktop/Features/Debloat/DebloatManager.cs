using System;
using System.Collections.Generic;
using System.Text.Json;

namespace VeloSysPro
{
    /// <summary>What one selected entry ended up doing to the machine.</summary>
    public sealed record DebloatPackageResult(string Id, bool Ok);

    /// <summary>
    /// The outcome of a removal batch. <paramref name="Results"/> is empty when the batch never
    /// started — an id outside the allow-list, or a Safety Checkpoint that could not be built.
    /// </summary>
    public sealed record DebloatBatchResult(bool Ok, IReadOnlyList<DebloatPackageResult> Results);

    /// <summary>
    /// Enumerates and removes the allow-listed preinstalled apps.
    /// </summary>
    /// <remarks>
    /// Deliberately not a Tweak. A Tweak captures the prior state and can put it back; an
    /// uninstalled app can only be reinstalled from the Store, by the user, outside this app. So
    /// Debloat gets its own boundary: an allow-list the payload cannot widen, a Safety Checkpoint
    /// that must exist before the first removal, and a per-entry result read back off the machine
    /// rather than off an exit code.
    /// </remarks>
    public sealed class DebloatManager
    {
        /// <summary>Serializable shape matching DebloatPackage in the React frontend.</summary>
        private record PackageInfo(string Id, string Group, string Caveat, bool Installed);

        private record CatalogInfo(IReadOnlyList<PackageInfo> Packages);

        private static readonly JsonSerializerOptions Options = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        };

        /// <summary>
        /// Asks Windows for the package names it has, and nothing else about them.
        /// </summary>
        /// <remarks>
        /// <c>Name</c> is the invariant family name (Microsoft.BingWeather); <c>DisplayName</c> is
        /// translated to the Windows display language and could not be matched against a catalog
        /// (`.agents/rules/locale-neutral-boundary-data.md`).
        /// </remarks>
        private const string EnumerateScript =
            "Get-AppxPackage | ForEach-Object { $_.Name } | ConvertTo-Json -Compress";

        /// <summary>
        /// The OneDrive install marker. Present while OneDrive is installed for this user and gone
        /// once its own uninstaller has run.
        /// </summary>
        private const string OneDriveKey = @"HKCU\Software\Microsoft\OneDrive";

        /// <summary>
        /// Locates the uninstaller Microsoft ships with OneDrive, wherever this machine put it.
        /// </summary>
        /// <remarks>
        /// Built with Join-Path against the environment rather than hardcoded C:\Windows, because
        /// the system drive is not always C: and the per-user install lives somewhere else again.
        /// </remarks>
        private const string OneDriveUninstallerScript =
            "@((Join-Path $env:SystemRoot 'SysWOW64\\OneDriveSetup.exe'), "
            + "(Join-Path $env:SystemRoot 'System32\\OneDriveSetup.exe'), "
            + "(Join-Path $env:LOCALAPPDATA 'Microsoft\\OneDrive\\OneDriveSetup.exe')) | "
            + "Where-Object { Test-Path $_ } | Select-Object -First 1";

        private readonly DebloatCatalog _catalog;
        private readonly ICommandRunner _cmd;
        private readonly SafetyCheckpoint _checkpoint;
        private readonly IStatusSink _sink;

        public DebloatManager(
            DebloatCatalog catalog,
            ICommandRunner cmd,
            SafetyCheckpoint checkpoint,
            IStatusSink sink
        )
        {
            _catalog = catalog;
            _cmd = cmd;
            _checkpoint = checkpoint;
            _sink = sink;
        }

        /// <summary>The allow-list with each entry's live installed state, as the debloatLoaded payload.</summary>
        public string GetPackagesJson()
        {
            HashSet<string> installed = ReadInstalledPackageNames();
            bool oneDrive = IsOneDriveInstalled();

            var packages = new List<PackageInfo>(_catalog.Entries.Count);
            foreach (DebloatEntry entry in _catalog.Entries)
            {
                packages.Add(
                    new PackageInfo(
                        entry.Id,
                        entry.Group.ToString(),
                        entry.Caveat,
                        IsPresent(entry, installed, oneDrive)
                    )
                );
            }

            return JsonSerializer.Serialize(new CatalogInfo(packages), Options);
        }

        /// <summary>
        /// Uninstalls the selected entries behind one Safety Checkpoint, and reports what really
        /// went.
        /// </summary>
        /// <remarks>
        /// The whole batch is resolved against the allow-list before anything runs, so a payload
        /// carrying one unknown id costs the machine nothing at all — not even a restore point.
        /// Unlike a Tweak batch, an entry that fails cannot be retried into place by the app, so
        /// each one is reported separately instead of collapsing into a single "partly worked".
        /// </remarks>
        public DebloatBatchResult Remove(IReadOnlyList<string> ids)
        {
            var nothing = Array.Empty<DebloatPackageResult>();

            if (ids.Count == 0)
            {
                _sink.Log("log.debloat.noneSelected", "error");
                return new DebloatBatchResult(false, nothing);
            }

            var entries = new List<DebloatEntry>(ids.Count);
            foreach (string id in ids)
            {
                DebloatEntry? entry = _catalog.Find(id);
                if (entry == null)
                {
                    _sink.Log("log.debloat.unknown", "error", new { id });
                    return new DebloatBatchResult(false, nothing);
                }
                entries.Add(entry);
            }

            if (!_checkpoint.Build()) return new DebloatBatchResult(false, nothing);

            int done = 0;
            foreach (DebloatEntry entry in entries)
            {
                _sink.Status(
                    "status.debloat.removing",
                    20 + (60 * done++ / entries.Count),
                    new { id = entry.Id }
                );
                Uninstall(entry);
            }

            _sink.Status("status.debloat.verifying", 90);

            // Read the machine back rather than trusting the exit codes: Remove-AppxPackage can
            // decline a package Windows considers in use and still leave a zero behind it.
            HashSet<string> stillInstalled = ReadInstalledPackageNames();
            bool oneDriveStillInstalled = IsOneDriveInstalled();

            var results = new List<DebloatPackageResult>(entries.Count);
            bool ok = true;
            foreach (DebloatEntry entry in entries)
            {
                bool gone = !IsPresent(entry, stillInstalled, oneDriveStillInstalled);
                results.Add(new DebloatPackageResult(entry.Id, gone));
                ok &= gone;
                _sink.Log(
                    gone ? "log.debloat.removed" : "log.debloat.removeFailed",
                    gone ? "success" : "error",
                    new { id = entry.Id }
                );
            }

            _sink.Status("status.debloat.done", 100);
            _sink.Log(ok ? "log.debloat.done" : "log.op.completedWithErrors", ok ? "success" : "error");

            return new DebloatBatchResult(ok, results);
        }

        private void Uninstall(DebloatEntry entry)
        {
            if (entry.Removal == DebloatRemoval.OneDriveUninstaller)
            {
                UninstallOneDrive();
                return;
            }

            foreach (string package in entry.Packages)
            {
                // The name is a catalog constant, never a payload value, so there is nothing here
                // an id from the frontend could steer.
                _cmd.Run(
                    "powershell.exe",
                    "-ExecutionPolicy Bypass -Command \"Get-AppxPackage -Name '"
                        + package
                        + "' | Remove-AppxPackage\""
                );
            }
        }

        private void UninstallOneDrive()
        {
            CaptureResult query = _cmd.RunCapture(
                "powershell.exe",
                "-ExecutionPolicy Bypass -Command \"" + OneDriveUninstallerScript + "\""
            );

            string path = query.Success ? query.Output.Trim() : "";
            if (path.Length == 0)
            {
                // Nothing to run, and nothing worth guessing at: the read-back below will report
                // the entry as still installed, which is the truth.
                _sink.Log("log.debloat.noUninstaller", "error", new { id = "oneDrive" });
                return;
            }

            _cmd.Run(path, "/uninstall");
        }

        private static bool IsPresent(
            DebloatEntry entry,
            HashSet<string> installedPackages,
            bool oneDriveInstalled
        )
        {
            if (entry.Removal == DebloatRemoval.OneDriveUninstaller) return oneDriveInstalled;

            foreach (string package in entry.Packages)
            {
                if (installedPackages.Contains(package)) return true;
            }
            return false;
        }

        /// <summary>
        /// The invariant names of every Appx package installed for the current user.
        /// </summary>
        /// <remarks>
        /// An unreadable answer returns an empty set, which reports every entry as not installed.
        /// That is the safe direction: the UI excludes what it cannot see from submission, so a
        /// failed query offers nothing to remove instead of offering to remove everything.
        /// </remarks>
        private HashSet<string> ReadInstalledPackageNames()
        {
            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            CaptureResult query = _cmd.RunCapture(
                "powershell.exe",
                "-ExecutionPolicy Bypass -Command \"" + EnumerateScript + "\""
            );
            if (!query.Success) return names;

            string raw = query.Output.Trim();
            if (raw.Length == 0) return names;

            try
            {
                using JsonDocument document = JsonDocument.Parse(raw);
                // ConvertTo-Json drops the array wrapper when the pipeline yields exactly one item.
                if (document.RootElement.ValueKind == JsonValueKind.String)
                {
                    names.Add(document.RootElement.GetString()!);
                    return names;
                }

                if (document.RootElement.ValueKind != JsonValueKind.Array) return names;

                foreach (JsonElement element in document.RootElement.EnumerateArray())
                {
                    if (element.ValueKind == JsonValueKind.String) names.Add(element.GetString()!);
                }
            }
            catch (JsonException)
            {
                _sink.Log("log.debloat.enumerateFailed", "error");
            }

            return names;
        }

        /// <summary>Whether OneDrive is installed for the current user.</summary>
        /// <remarks>
        /// Read from the per-user key rather than by probing for OneDriveSetup.exe: the setup
        /// binary ships with Windows and stays on disk after an uninstall, so its presence would
        /// report OneDrive as installed forever.
        /// </remarks>
        private bool IsOneDriveInstalled()
        {
            CaptureResult query = _cmd.RunCapture(
                "reg.exe",
                "query \"" + OneDriveKey + "\" /v CurrentVersionPath"
            );

            return query.Success
                && query.Output.Contains("CurrentVersionPath", StringComparison.OrdinalIgnoreCase);
        }
    }
}
