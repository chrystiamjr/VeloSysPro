# VeloSys Pro Glossary

Canonical domain terminology and architectural concepts for the VeloSys Pro project.

## Terms

**IPC Bridge**:
The WebView2 IPC messaging interface between the React 18 TypeScript frontend (`window.chrome.webview.postMessage`) and the C# .NET 8 WPF desktop host handler (`desktop/MainWindow.xaml.cs`).
_Avoid_: Direct system call, raw socket

**Junction Links**:
NTFS Directory Junctions (`New-Item -Type Junction`) used to link central skills from `~/.agents/skills/` to target AI directories without requiring Administrator privileges on Windows.
_Avoid_: Hard copy, symlink shortcut

**Single Executable Deliverable**:
The unified release executable `VeloSysPro.exe` containing bundled frontend assets and WPF host binary.
_Avoid_: `.bat` launcher script, nested subfolder launch

**Atomic Design Hierarchy**:
Structuring React components into `atoms/`, `molecules/`, `organisms/`, `templates/`, and `pages/` using TypeScript interfaces.
_Avoid_: Monolithic components, runtime propTypes
