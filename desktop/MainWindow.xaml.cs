using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Diagnostics;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace VeloSysPro
{
    public partial class MainWindow : Window, IStatusSink
    {
        private readonly string _appDir;
        private readonly string _logsDir;
        private readonly string _backupsDir;
        private readonly string _logFile;
        private readonly string _errorLogFile;

        private readonly CommandRunner _cmd;
        private readonly BackupManager _backup;
        private readonly Optimizer _optimizer;
        private readonly SchedulerManager _scheduler;
        private readonly SettingsManager _settings;

        // Command table mapping IPC action names to hibernated delegates
        private readonly Dictionary<string, Action<string>> _actionHandlers;

        // Maps normalized (forward-slash) embedded resource names to their real manifest names.
        private Dictionary<string, string> _resourceMap = new();

        public MainWindow()
        {
            InitializeComponent();

            _appDir = AppDomain.CurrentDomain.BaseDirectory;
            _logsDir = Path.Combine(_appDir, "logs");
            _backupsDir = Path.Combine(_appDir, "backups");
            _logFile = Path.Combine(_logsDir, "log.txt");
            _errorLogFile = Path.Combine(_logsDir, "error_log.txt");

            Directory.CreateDirectory(_logsDir);
            Directory.CreateDirectory(_backupsDir);

            // Wire up the service classes with this window as the status sink.
            _cmd = new CommandRunner(this);
            _backup = new BackupManager(_backupsDir, _cmd, this);
            _optimizer = new Optimizer(_cmd, _backup, this, PushBackups);
            _scheduler = new SchedulerManager(_cmd, this);
            _settings = new SettingsManager();
            _optimizer.CreateSafetyBackupEnabled = _settings.Current.CreateBackupBeforeOptimize;

            _actionHandlers = RegisterActionHandlers();

            Loaded += MainWindow_Loaded;
        }

        private Dictionary<string, Action<string>> RegisterActionHandlers()
        {
            return new Dictionary<string, Action<string>>
            {
                { SystemActions.RunQuickOptimization, _ => _optimizer.RunQuick() },
                { SystemActions.RunFullOptimization, _ => _optimizer.RunFull() },
                { SystemActions.RunGamingMode, _ => _optimizer.RunGaming() },
                { SystemActions.RevertDefaults, _ => _optimizer.RevertDefaults() },
                { SystemActions.ClearUpdateCache, _ => _optimizer.ClearUpdateCache() },
                { SystemActions.CleanPrefetch, _ => _optimizer.CleanPrefetch() },
                { SystemActions.DiskHealth, _ => _optimizer.ReportDiskHealth() },
                { SystemActions.CreateManualBackup, _ => { _backup.CreateBackup(); PushBackups(); } },
                { SystemActions.RestoreBackup, payload => _backup.RestoreBackup(payload) },
                { SystemActions.CreateRestorePoint, _ => { _backup.CreateRestorePoint(); PushRestorePoints(); } },
                { SystemActions.GetRestorePoints, _ => PushRestorePoints() },
                { SystemActions.RestoreToPoint, payload => _backup.RestoreToPoint(payload) },
                { SystemActions.GetSettings, _ => EvalJs("window.onSettingsLoaded && window.onSettingsLoaded(" + _settings.GetJson() + ");") },
                { SystemActions.SaveSettings, payload => {
                    var applied = _settings.Save(payload);
                    _optimizer.CreateSafetyBackupEnabled = applied.CreateBackupBeforeOptimize;
                } },
                { SystemActions.OpenUrl, payload => {
                    if (payload.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                    {
                        Process.Start(new ProcessStartInfo { FileName = payload, UseShellExecute = true });
                    }
                } },
                { SystemActions.OpenLogs, _ => Process.Start("explorer.exe", _logsDir) },
                { SystemActions.OpenBackups, _ => Process.Start("explorer.exe", _backupsDir) },
                { SystemActions.GetBackups, _ => PushBackups() },
                { SystemActions.GetTasks, _ => PushTasks() },
                { SystemActions.CreateTask, payload => { _scheduler.CreateTask(payload); PushTasks(); } },
                { SystemActions.DeleteTask, payload => { _scheduler.DeleteTask(payload); PushTasks(); } },
            };
        }

        private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            await InitializeWebView();
            _ = CheckForUpdatesAsync();
        }

        private async Task CheckForUpdatesAsync()
        {
            try
            {
                UpdateChecker.UpdateInfo? info = await UpdateChecker.CheckAsync();
                if (info != null)
                {
                    string payload = JsonSerializer.Serialize(new { version = info.Version, url = info.Url });
                    EvalJs("window.onUpdateAvailable && window.onUpdateAvailable(" + payload + ");");
                }
            }
            catch { }
        }

        private async Task InitializeWebView()
        {
            try
            {
                // Build a lookup of the ui/ assets embedded into the single-file exe.
                Assembly asm = Assembly.GetExecutingAssembly();
                _resourceMap = asm
                    .GetManifestResourceNames()
                    .ToDictionary(n => n.Replace('\\', '/'), n => n);

                string userDataFolder = Path.Combine(_appDir, "webview_data");
                Directory.CreateDirectory(userDataFolder);

                var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
                await webView.EnsureCoreWebView2Async(env);

                // Serve the React bundle straight from embedded resources (no ui/ folder on disk).
                webView.CoreWebView2.AddWebResourceRequestedFilter(
                    "https://velosys.app/*",
                    CoreWebView2WebResourceContext.All
                );
                webView.CoreWebView2.WebResourceRequested += CoreWebView2_WebResourceRequested;

                webView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;

                webView.CoreWebView2.Navigate("https://velosys.app/index.html");

                Log("log.hostReady", "success");
            }
            catch (Exception ex)
            {
                LogRaw("WebView2 init failed: " + ex.Message, "error");
            }
        }

        private void CoreWebView2_WebResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
        {
            try
            {
                var uri = new Uri(e.Request.Uri);
                string path = uri.AbsolutePath.TrimStart('/');
                if (string.IsNullOrEmpty(path)) path = "index.html";

                string key = "ui/" + path;

                if (_resourceMap.TryGetValue(key, out string? resourceName))
                {
                    Stream? stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resourceName);
                    if (stream != null)
                    {
                        var managed = new ManagedStream(stream);
                        string headers = "Content-Type: " + GetMimeType(path);
                        e.Response = webView.CoreWebView2.Environment.CreateWebResourceResponse(
                            managed, 200, "OK", headers);
                        return;
                    }
                }

                e.Response = webView.CoreWebView2.Environment.CreateWebResourceResponse(
                    null, 404, "Not Found", "");
            }
            catch (Exception ex)
            {
                LogRaw("Failed to serve embedded resource: " + ex.Message, "error");
                e.Response = webView.CoreWebView2.Environment.CreateWebResourceResponse(
                    null, 404, "Not Found", "");
            }
        }

        private static string GetMimeType(string path)
        {
            string ext = Path.GetExtension(path).ToLowerInvariant();
            return ext switch
            {
                ".html" => "text/html; charset=utf-8",
                ".js" => "application/javascript; charset=utf-8",
                ".mjs" => "application/javascript; charset=utf-8",
                ".css" => "text/css; charset=utf-8",
                ".json" => "application/json; charset=utf-8",
                ".svg" => "image/svg+xml",
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".gif" => "image/gif",
                ".ico" => "image/x-icon",
                ".woff" => "font/woff",
                ".woff2" => "font/woff2",
                ".ttf" => "font/ttf",
                ".map" => "application/json; charset=utf-8",
                _ => "application/octet-stream",
            };
        }

        private void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                IpcHandler.IpcMessage? msg = IpcHandler.Parse(e.WebMessageAsJson);
                if (msg != null)
                {
                    HandleAction(msg.Action, msg.Payload);
                }
            }
            catch (Exception ex)
            {
                LogRaw("IPC error: " + ex.Message, "error");
            }
        }

        public void HandleAction(string action, string payload)
        {
            ThreadPool.QueueUserWorkItem(_ =>
            {
                bool ok = true;
                try
                {
                    if (_actionHandlers.TryGetValue(action, out var handler))
                    {
                        handler(payload);
                    }
                    else
                    {
                        LogRaw("Unknown action requested: '" + action + "'", "warning");
                        ok = false;
                    }
                }
                catch (Exception ex)
                {
                    LogRaw("Action '" + action + "' failed: " + ex.Message, "error");
                    ok = false;
                }
                finally
                {
                    // Authoritative signal so the UI always releases its action lock,
                    // even when an action errors before emitting 100% progress.
                    EmitActionFinished(action, ok);
                }
            });
        }

        private void EmitActionFinished(string action, bool ok)
        {
            string actionLiteral = JsonSerializer.Serialize(action);
            EvalJs("window.onActionFinished && window.onActionFinished(" + actionLiteral + ", " + (ok ? "true" : "false") + ");");
        }

        private void PushBackups()
        {
            try
            {
                string json = _backup.GetBackupsJson();
                EvalJs("window.onBackupsLoaded && window.onBackupsLoaded(" + json + ");");
            }
            catch (Exception ex)
            {
                LogRaw("Failed to refresh backups: " + ex.Message, "error");
            }
        }

        private void PushTasks()
        {
            try
            {
                string json = _scheduler.GetTasksJson();
                EvalJs("window.onTasksLoaded && window.onTasksLoaded(" + json + ");");
            }
            catch (Exception ex)
            {
                LogRaw("Failed to refresh tasks: " + ex.Message, "error");
            }
        }

        private void PushRestorePoints()
        {
            try
            {
                string json = _backup.GetRestorePointsJson();
                EvalJs("window.onRestorePointsLoaded && window.onRestorePointsLoaded(" + json + ");");
            }
            catch (Exception ex)
            {
                LogRaw("Failed to refresh restore points: " + ex.Message, "error");
            }
        }

        // ---- IStatusSink implementation ----

        public void Log(string key, string type, object? args = null)
        {
            WriteFileLog(key, type == "error" ? _errorLogFile : _logFile);
            string payload = JsonSerializer.Serialize(new { key, args });
            EvalJs("window.onLogReceived && window.onLogReceived(" + payload + ", '" + type + "');");
        }

        public void LogRaw(string text, string type)
        {
            WriteFileLog(text, type == "error" ? _errorLogFile : _logFile);
            string payload = JsonSerializer.Serialize(new { key = "log.raw", args = new { text } });
            EvalJs("window.onLogReceived && window.onLogReceived(" + payload + ", '" + type + "');");
        }

        public void Status(string key, int percent, object? args = null)
        {
            string payload = JsonSerializer.Serialize(new { key, args });
            EvalJs("window.onStatusUpdated && window.onStatusUpdated(" + payload + ");");
            EvalJs("window.onProgressUpdated && window.onProgressUpdated(" + percent + ");");
        }

        private void WriteFileLog(string message, string file)
        {
            try
            {
                string line = "[" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "] " + message;
                File.AppendAllText(file, line + Environment.NewLine, Encoding.UTF8);
            }
            catch { }
        }

        private void EvalJs(string js)
        {
            try
            {
                Dispatcher.Invoke(() =>
                {
                    if (webView != null && webView.CoreWebView2 != null)
                    {
                        webView.CoreWebView2.ExecuteScriptAsync(js);
                    }
                });
            }
            catch { }
        }
    }
}
