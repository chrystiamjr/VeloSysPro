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

            Loaded += MainWindow_Loaded;
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

                Log("logHostReady", "success");
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
                try
                {
                    switch (action)
                    {
                        case "runQuickOptimization":
                            _optimizer.RunQuick();
                            break;
                        case "runFullOptimization":
                            _optimizer.RunFull();
                            break;
                        case "runGamingMode":
                            _optimizer.RunGaming();
                            break;
                        case "revertDefaults":
                            _optimizer.RevertDefaults();
                            break;
                        case "clearUpdateCache":
                            _optimizer.ClearUpdateCache();
                            break;
                        case "cleanPrefetch":
                            _optimizer.CleanPrefetch();
                            break;
                        case "diskHealth":
                            _optimizer.ReportDiskHealth();
                            break;
                        case "createManualBackup":
                            _backup.CreateBackup();
                            PushBackups();
                            break;
                        case "restoreBackup":
                            _backup.RestoreBackup(payload);
                            break;
                        case "createRestorePoint":
                            _backup.CreateRestorePoint();
                            PushRestorePoints();
                            break;
                        case "getRestorePoints":
                            PushRestorePoints();
                            break;
                        case "restoreToPoint":
                            _backup.RestoreToPoint(payload);
                            break;
                        case "getSettings":
                            EvalJs("window.onSettingsLoaded && window.onSettingsLoaded(" + _settings.GetJson() + ");");
                            break;
                        case "saveSettings":
                            var applied = _settings.Save(payload);
                            _optimizer.CreateSafetyBackupEnabled = applied.CreateBackupBeforeOptimize;
                            break;
                        case "openUrl":
                            if (payload.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                            {
                                Process.Start(new ProcessStartInfo { FileName = payload, UseShellExecute = true });
                            }
                            break;
                        case "openLogs":
                            Process.Start("explorer.exe", _logsDir);
                            break;
                        case "openBackups":
                            Process.Start("explorer.exe", _backupsDir);
                            break;
                        case "getBackups":
                            PushBackups();
                            break;
                        case "getTasks":
                            PushTasks();
                            break;
                        case "createTask":
                            _scheduler.CreateTask(payload);
                            PushTasks();
                            break;
                        case "deleteTask":
                            _scheduler.DeleteTask(payload);
                            PushTasks();
                            break;
                    }
                }
                catch (Exception ex)
                {
                    LogRaw("Action '" + action + "' failed: " + ex.Message, "error");
                }
            });
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
            string payload = JsonSerializer.Serialize(new { key = "logRaw", args = new { text } });
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
