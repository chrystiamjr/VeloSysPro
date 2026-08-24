using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Windows;

namespace VeloSysPro
{
    public partial class MainWindow : Window, IStatusSink
    {
        private readonly string _logsDir;
        private readonly string _backupsDir;
        private readonly string _logFile;
        private readonly string _errorLogFile;

        private readonly IpcEventEmitter _events;
        private readonly HostServices _services;
        private readonly WebViewHost _webViewHost;

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

            // Composed outside the window, where a test can see it. Wiring assembled in here is
            // invisible to the test project, and that is how the Tweaks engine came to keep its own
            // Safety Checkpoint and ignore the user's stored preference until Settings was saved
            // again (#53).
            // Built before the services, because this window is also their IStatusSink: anything
            // logged while they are being composed has to reach an emitter that already exists.
            _events = new IpcEventEmitter(json => _webViewHost?.PostEventJson(json));
            _services = new HostServices(this, _events, _logsDir, _backupsDir);

            _webViewHost = new WebViewHost(webView, _services.ActionHost, this, Dispatcher);

            Loaded += MainWindow_Loaded;
        }

        private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            await TryInitializeWebViewAsync();
            _ = CheckForUpdatesAsync();
        }

        private async Task TryInitializeWebViewAsync()
        {
            try
            {
                await _webViewHost.InitializeAsync();
            }
            catch (Exception ex)
            {
                LogRaw("WebView2 init failed: " + ex.Message, "error");
                ShowFallbackUI(ex.Message);
            }
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

        private void ShowFallbackUI(string message)
        {
            Dispatcher.Invoke(() =>
            {
                if (fallbackOverlay != null)
                {
                    fallbackOverlay.Visibility = Visibility.Visible;
                    if (fallbackErrorMessage != null)
                    {
                        fallbackErrorMessage.Text = $"Falha ao inicializar o componente WebView2.\nDetalhe: {message}";
                    }
                }
            });
        }

        private async void InstallWebView2_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                if (fallbackErrorMessage != null)
                {
                    fallbackErrorMessage.Text = "Baixando e instalando o Microsoft Edge WebView2 Runtime... Aguarde alguns segundos.";
                }

                string setupPath = Path.Combine(Path.GetTempPath(), "MicrosoftEdgeWebview2Setup.exe");
                if (!File.Exists(setupPath))
                {
                    using var client = new HttpClient();
                    byte[] data = await client.GetByteArrayAsync("https://go.microsoft.com/fwlink/p/?LinkId=2124703");
                    await File.WriteAllBytesAsync(setupPath, data);
                }

                var psi = new ProcessStartInfo
                {
                    FileName = setupPath,
                    Arguments = "/silent /install",
                    UseShellExecute = true
                };

                using var proc = Process.Start(psi);
                if (proc != null)
                {
                    await proc.WaitForExitAsync();
                }

                if (fallbackOverlay != null)
                {
                    fallbackOverlay.Visibility = Visibility.Collapsed;
                }

                await TryInitializeWebViewAsync();
            }
            catch (Exception ex)
            {
                if (fallbackErrorMessage != null)
                {
                    fallbackErrorMessage.Text = "Erro ao instalar WebView2: " + ex.Message;
                }
            }
        }

        private async void RetryWebView2_Click(object sender, RoutedEventArgs e)
        {
            if (fallbackOverlay != null)
            {
                fallbackOverlay.Visibility = Visibility.Collapsed;
            }
            await TryInitializeWebViewAsync();
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
    }
}
