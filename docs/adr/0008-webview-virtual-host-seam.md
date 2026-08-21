# WebView Virtual Host Resource Streaming Seam

The WebView2 control is hosted and managed by a dedicated deep module `WebViewHost` rather than procedural setup logic embedded in `MainWindow.xaml.cs`. The host serves frontend single-page application assets from embedded assembly resources mapped to a custom virtual host `https://velosys.app/`.

## Considered Options

- File-based `file:///` URLs with disk assets.
- Embedded local HTTP dev server (`HttpListener`).
- CoreWebView2 `SetVirtualHostNameToFolderMapping` with embedded manifest resource streaming (`WebViewHost`).

## Consequences

- Standalone single-file executable deliverable (`VeloSysPro.exe`) with zero external asset folder dependencies.
- Zero CORS/origin restrictions across WebView2 security boundaries.
- Clean separation between WPF window lifecycle (`MainWindow.xaml.cs`) and WebView2 initialization, virtual domain mapping, and two-way IPC dispatch.
