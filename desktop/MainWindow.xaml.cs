using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Diagnostics;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace VeloSysPro
{
    public partial class MainWindow : Window
    {
        private readonly string _appDir;
        private readonly string _logsDir;
        private readonly string _backupsDir;
        private readonly string _logFile;
        private readonly string _errorLogFile;

        private readonly CommandRunner _cmd;
        private readonly BackupManager _backup;

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

            // Wire up the previously-orphaned service classes.
            _cmd = new CommandRunner(Log, LogError);
            _backup = new BackupManager(_backupsDir, _cmd, Log, LogError);

            Loaded += MainWindow_Loaded;
        }

        private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            await InitializeWebView();
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

                Log("VeloSys Pro .NET 8 WPF Host + Edge Chromium WebView2 inicializado (UI embutida em https://velosys.app/).", "success");
            }
            catch (Exception ex)
            {
                LogError("Falha ao inicializar WebView2 no .NET 8: " + ex.Message);
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
                LogError("Erro ao servir recurso embutido: " + ex.Message);
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
                LogError("Erro IPC WebView2: " + ex.Message);
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
                            RunQuickOpt();
                            break;
                        case "runFullOptimization":
                            RunFullOpt();
                            break;
                        case "runGamingMode":
                            RunGamingMode();
                            break;
                        case "revertDefaults":
                            RunRevertDefaults();
                            break;
                        case "createManualBackup":
                            _backup.CreateBackup();
                            PushBackups();
                            break;
                        case "restoreBackup":
                            _backup.RestoreBackup(payload);
                            break;
                        case "createRestorePoint":
                            _backup.CreateRestorePoint(UpdateStatus);
                            break;
                        case "openLogs":
                            Process.Start("explorer.exe", _logsDir);
                            break;
                        case "openBackups":
                            Process.Start("explorer.exe", _backupsDir);
                            break;
                        case "openRestorePoints":
                            Process.Start(new ProcessStartInfo
                            {
                                FileName = "powershell.exe",
                                Arguments = "-NoExit -Command Get-ComputerRestorePoint",
                                UseShellExecute = true
                            });
                            break;
                        case "getBackups":
                            PushBackups();
                            break;
                        case "getTasks":
                            EvalJs("window.onTasksLoaded && window.onTasksLoaded([]);");
                            break;
                    }
                }
                catch (Exception ex)
                {
                    LogError("Erro ao executar ação '" + action + "': " + ex.Message);
                }
            });
        }

        private void RunQuickOpt()
        {
            UpdateStatus("Iniciando Otimização Rápida...", 10);
            Log("Iniciando Otimização Rápida...", "info");
            _backup.CreateBackup();
            PushBackups();

            UpdateStatus("[1/3] Limpando cache DNS...", 30);
            _cmd.Run("ipconfig.exe", "/flushdns");

            UpdateStatus("[2/3] Executando limpeza de temporários...", 65);
            _cmd.Run("cleanmgr.exe", "/verylowdisk");

            UpdateStatus("[3/3] Finalizando limpeza de arquivos...", 90);
            _cmd.CleanTempFolder();

            UpdateStatus("Otimização Rápida concluída com sucesso!", 100);
            Log("Otimização Rápida concluída com sucesso.", "success");
        }

        private void RunFullOpt()
        {
            UpdateStatus("Iniciando Otimização Completa...", 10);
            Log("Iniciando Otimização Completa...", "info");
            _backup.CreateBackup();
            PushBackups();

            UpdateStatus("[1/4] Verificando arquivos do sistema (SFC)...", 25);
            _cmd.Run("sfc.exe", "/scannow");

            UpdateStatus("[2/4] Limpando imagem do sistema (DISM)...", 50);
            _cmd.Run("dism.exe", "/online /cleanup-image /restorehealth");

            UpdateStatus("[3/4] Limpando cache DNS...", 75);
            _cmd.Run("ipconfig.exe", "/flushdns");

            UpdateStatus("[4/4] Limpando arquivos temporários...", 90);
            _cmd.CleanTempFolder();

            UpdateStatus("Otimização Completa concluída!", 100);
            Log("Otimização Completa concluída com sucesso.", "success");
        }

        private void RunGamingMode()
        {
            UpdateStatus("Aplicando Modo Gaming...", 10);
            Log("Aplicando ajustes de rede para baixa latência (Modo Gaming)...", "info");
            _backup.CreateBackup();
            PushBackups();

            UpdateStatus("Habilitando RSS...", 40);
            _cmd.Run("netsh.exe", "int tcp set global rss=enabled");

            UpdateStatus("Ajustando autotuning...", 70);
            _cmd.Run("netsh.exe", "int tcp set global autotuninglevel=normal");

            UpdateStatus("Limpando DNS...", 90);
            _cmd.Run("ipconfig.exe", "/flushdns");

            UpdateStatus("Modo Gaming aplicado com sucesso!", 100);
            Log("Modo Gaming aplicado com sucesso.", "success");
        }

        private void RunRevertDefaults()
        {
            UpdateStatus("Revertendo configurações...", 10);
            Log("Revertendo configurações de rede para o padrão...", "info");

            UpdateStatus("Resetando IP stack...", 40);
            _cmd.Run("netsh.exe", "int ip reset");

            UpdateStatus("Resetando Winsock...", 70);
            _cmd.Run("netsh.exe", "winsock reset");

            UpdateStatus("Limpando DNS...", 90);
            _cmd.Run("ipconfig.exe", "/flushdns");

            UpdateStatus("Configurações revertidas para o padrão!", 100);
            Log("Configurações revertidas com sucesso.", "success");
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
                LogError("Falha ao atualizar lista de backups: " + ex.Message);
            }
        }

        public void Log(string msg, string type)
        {
            try
            {
                string line = "[" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "] " + msg;
                File.AppendAllText(_logFile, line + Environment.NewLine, Encoding.UTF8);

                EvalJs("window.onLogReceived && window.onLogReceived('" + EscapeJs(msg) + "', '" + type + "');");
            }
            catch { }
        }

        public void LogError(string msg)
        {
            try
            {
                string line = "[" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "] ERRO: " + msg;
                File.AppendAllText(_errorLogFile, line + Environment.NewLine, Encoding.UTF8);

                EvalJs("window.onLogReceived && window.onLogReceived('ERRO: " + EscapeJs(msg) + "', 'error');");
            }
            catch { }
        }

        public void UpdateStatus(string statusMsg, int progressPercent)
        {
            try
            {
                EvalJs("window.onStatusUpdated && window.onStatusUpdated('Status: " + EscapeJs(statusMsg) + "');");
                EvalJs("window.onProgressUpdated && window.onProgressUpdated(" + progressPercent + ");");
            }
            catch { }
        }

        private static string EscapeJs(string value)
        {
            return value
                .Replace("\\", "\\\\")
                .Replace("'", "\\'")
                .Replace("\r", " ")
                .Replace("\n", " ");
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
