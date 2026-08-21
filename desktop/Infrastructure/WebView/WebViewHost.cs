using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace VeloSysPro
{
    /// <summary>
    /// Deep module encapsulating Microsoft Edge WebView2 initialization, embedded virtual host
    /// asset streaming (https://velosys.app/), and two-way IPC event and action dispatching.
    /// </summary>
    public sealed class WebViewHost
    {
        private readonly WebView2 _webView;
        private readonly ActionHost _actionHost;
        private readonly IStatusSink _sink;
        private readonly Dispatcher _dispatcher;
        private Dictionary<string, string> _resourceMap = new();

        public WebViewHost(WebView2 webView, ActionHost actionHost, IStatusSink sink, Dispatcher dispatcher)
        {
            _webView = webView;
            _actionHost = actionHost;
            _sink = sink;
            _dispatcher = dispatcher;
        }

        public async Task InitializeAsync()
        {
            // Build a lookup of the ui/ assets embedded into the single-file exe.
            Assembly asm = Assembly.GetExecutingAssembly();
            _resourceMap = asm
                .GetManifestResourceNames()
                .ToDictionary(n => n.Replace('\\', '/'), n => n);

            string? customBrowserFolder = FindEdgeWebViewDirectory();
            var env = await CoreWebView2Environment.CreateAsync(customBrowserFolder, AppPaths.WebViewData);
            await _webView.EnsureCoreWebView2Async(env);

            // Serve the React bundle straight from embedded resources (no ui/ folder on disk).
            _webView.CoreWebView2.AddWebResourceRequestedFilter(
                "https://velosys.app/*",
                CoreWebView2WebResourceContext.All
            );
            _webView.CoreWebView2.WebResourceRequested += OnWebResourceRequested;
            _webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
            _webView.CoreWebView2.Navigate("https://velosys.app/index.html");

            _sink.Log("log.hostReady", "success");
        }

        public void PostEventJson(string json)
        {
            try
            {
                _dispatcher.Invoke(() =>
                {
                    if (_webView.CoreWebView2 != null)
                    {
                        _webView.CoreWebView2.PostWebMessageAsJson(json);
                    }
                });
            }
            catch (Exception ex)
            {
                _sink.LogRaw("Failed to post Event to UI: " + ex.Message, "error");
            }
        }

        private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
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
                _sink.LogRaw("IPC error: " + ex.Message, "error");
            }
        }

        private void OnWebResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
        {
            try
            {
                var uri = new Uri(e.Request.Uri);
                string resourcePath = "ui" + uri.AbsolutePath;
                if (resourcePath.EndsWith('/') || resourcePath == "ui" || resourcePath == "ui/")
                {
                    resourcePath = "ui/index.html";
                }

                if (!_resourceMap.TryGetValue(resourcePath, out string? manifestName))
                {
                    _resourceMap.TryGetValue("ui/index.html", out manifestName);
                }

                if (manifestName == null)
                {
                    e.Response = _webView.CoreWebView2.Environment.CreateWebResourceResponse(
                        null, 404, "Not Found", "Content-Type: text/plain"
                    );
                    return;
                }

                Stream? stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(manifestName);
                if (stream == null)
                {
                    e.Response = _webView.CoreWebView2.Environment.CreateWebResourceResponse(
                        null, 404, "Not Found", "Content-Type: text/plain"
                    );
                    return;
                }

                string ext = Path.GetExtension(resourcePath).ToLowerInvariant();
                string contentType = GetMimeType(ext);

                var managedStream = new ManagedStream(stream);
                e.Response = _webView.CoreWebView2.Environment.CreateWebResourceResponse(
                    managedStream,
                    200,
                    "OK",
                    $"Content-Type: {contentType}\nAccess-Control-Allow-Origin: *"
                );
            }
            catch (Exception ex)
            {
                _sink.LogRaw("Resource error: " + ex.Message, "error");
            }
        }

        private static string GetMimeType(string ext) =>
            ext switch
            {
                ".html" => "text/html; charset=utf-8",
                ".js" => "application/javascript; charset=utf-8",
                ".css" => "text/css; charset=utf-8",
                ".json" => "application/json; charset=utf-8",
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".svg" => "image/svg+xml",
                ".ico" => "image/x-icon",
                ".woff2" => "font/woff2",
                ".woff" => "font/woff",
                ".ttf" => "font/ttf",
                ".map" => "application/json; charset=utf-8",
                _ => "application/octet-stream",
            };

        public static string? FindEdgeWebViewDirectory()
        {
            string[] searchPaths = new[]
            {
                @"C:\Program Files (x86)\Microsoft\EdgeWebView\Application",
                @"C:\Program Files (x86)\Microsoft\Edge\Application",
                @"C:\Program Files\Microsoft\EdgeWebView\Application",
                @"C:\Program Files\Microsoft\Edge\Application"
            };

            foreach (var baseDir in searchPaths)
            {
                if (Directory.Exists(baseDir))
                {
                    var verDir = Directory.GetDirectories(baseDir)
                        .FirstOrDefault(d => File.Exists(Path.Combine(d, "msedgewebview2.exe")) || File.Exists(Path.Combine(d, "msedge.exe")));
                    if (verDir != null)
                    {
                        return verDir;
                    }
                }
            }
            return null;
        }
    }
}
