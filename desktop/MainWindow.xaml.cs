using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace VeloSysPro
{
    public partial class MainWindow : Window, IStatusSink
    {
        private readonly string _logsDir;
        private readonly string _backupsDir;
        private readonly string _logFile;
        private readonly string _errorLogFile;

        private readonly CommandRunner _cmd;
        private readonly RegistryBackupManager _backup;
        private readonly SystemRestoreManager _systemRestore;
        private readonly Optimizer _optimizer;
        private readonly SchedulerManager _scheduler;
        private readonly SettingsManager _settings;
        private readonly TweakEngine _tweaks;
        private readonly IpcEventEmitter _events;
        private readonly ActionHost _actionHost;

        // Maps normalized (forward-slash) embedded resource names to their real manifest names.
        private Dictionary<string, string> _resourceMap = new();

        public MainWindow()
        {
            InitializeComponent();

            AppPaths.EnsureRuntimeDirectories();
            _logsDir = AppPaths.Logs;
            _backupsDir = AppPaths.Backups;
            _logFile = Path.Combine(_logsDir, "log.txt");
            _errorLogFile = Path.Combine(_logsDir, "error_log.txt");

            Directory.CreateDirectory(_logsDir);
            Directory.CreateDirectory(_backupsDir);

            // Wire up the service classes with this window as the status sink.
            _cmd = new CommandRunner(this);
            _backup = new RegistryBackupManager(_backupsDir, _cmd, this);
            _systemRestore = new SystemRestoreManager(_cmd, this);
            _optimizer = new Optimizer(_cmd, _backup, this);
            _scheduler = new SchedulerManager(_cmd, this);
            _settings = new SettingsManager();
            _events = new IpcEventEmitter(PostEventJson);
            _tweaks = TweakEngine.CreateDefault(_cmd, _backup, _systemRestore, this);
            _optimizer.CreateSafetyBackupEnabled = _settings.Current.CreateBackupBeforeOptimize;
            _tweaks.CreateSafetyBackupEnabled = _settings.Current.CreateBackupBeforeOptimize;

            _actionHost = new ActionHost(
                _optimizer, _backup, _systemRestore, _scheduler, _settings, _tweaks,
                _events, this, _logsDir, _backupsDir
            );

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
                    _events.Emit(IpcEvents.UpdateAvailable, new { version = info.Version, url = info.Url });
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

                var env = await CoreWebView2Environment.CreateAsync(null, AppPaths.WebViewData);
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
                    _actionHost.Handle(msg);
                }
            }
            catch (Exception ex)
            {
                LogRaw("IPC error: " + ex.Message, "error");
            }
        }

        // ---- IStatusSink implementation ----

        public void Log(string key, string type, object? args = null)
        {
            WriteFileLog(key, type == "error" ? _errorLogFile : _logFile);
            _events.Emit(IpcEvents.LogReceived, new { message = new { key, args }, type });
        }

        public void LogRaw(string text, string type)
        {
            WriteFileLog(text, type == "error" ? _errorLogFile : _logFile);
            _events.Emit(
                IpcEvents.LogReceived,
                new { message = new { key = "log.raw", args = new { text } }, type }
            );
        }

        public void Status(string key, int percent, object? args = null)
        {
            _events.Emit(IpcEvents.StatusUpdated, new { key, args });
            _events.Emit(IpcEvents.ProgressUpdated, percent);
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

        private void PostEventJson(string json)
        {
            try
            {
                Dispatcher.Invoke(() =>
                {
                    if (webView != null && webView.CoreWebView2 != null)
                    {
                        webView.CoreWebView2.PostWebMessageAsJson(json);
                    }
                });
            }
            catch { }
        }
    }
}
