---
sidebar_position: 3
---

# Building & Testing

## Development Setup {#development-setup}

Clone the repository and install dependencies:

```bash
git clone https://github.com/chrystiamjr/VeloSysPro.git
cd VeloSysPro
npm install
npm run setup-hooks
```

## Running Tests {#running-tests}

### 1. Frontend Validation (Vitest + TypeScript)
Validate TypeScript types, formatting, ESLint rules, and run all 34 component test suites:
```bash
npm run validate
```

### 2. Backend Unit & Native Windows Integration Tests (xUnit)
Run all 270 backend unit and OS integration tests:
```bash
# Run unit tests only (in-memory command runners and fakes)
dotnet test desktop.Tests/ -c Release --filter "Category!=Integration"

# Run live native Windows OS integration tests (safe sandbox registry, PowerShell, schtasks, CLI boundary)
dotnet test desktop.Tests/ -c Release --filter "Category=Integration"

# Run the complete test suite
dotnet test desktop.Tests/VeloSysPro.Tests.csproj -c Release
```

### 3. Isolated Windows Sandbox Automated VM Testing {#sandbox-testing}
Test the self-contained executable in a completely isolated, clean Windows Hyper-V container:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test-sandbox.ps1
```
This script automatically:
- Builds the React UI and publishes a single-file, self-contained `win-x64` executable to `desktop/bin/Release/standalone/VeloSysPro.exe`.
- Stages files to `%TEMP%\VeloSysProSandboxStaging` to eliminate OneDrive reparse point locking.
- Downloads the Evergreen WebView2 Runtime bootstrapper and pre-installs it in the disposable container.
- Launches the VM and runs VeloSys Pro with zero host pollution.

## CLI Usage & Headless Commands {#cli-usage}

```powershell
# Query version and usage information headlessly
.\desktop\bin\Release\standalone\VeloSysPro.exe --version
.\desktop\bin\Release\standalone\VeloSysPro.exe --help

# Run scheduled tasks headlessly
.\desktop\bin\Release\standalone\VeloSysPro.exe --task=quick
.\desktop\bin\Release\standalone\VeloSysPro.exe --task=full
.\desktop\bin\Release\standalone\VeloSysPro.exe --task=gaming
.\desktop\bin\Release\standalone\VeloSysPro.exe --task=revert
```

## Building the Executable & Installer {#building-the-executable--installer}

To build the Vite bundle, compile the single `.exe`, and package the Inno Setup installer:

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

The output installer will be placed in `dist/VeloSysPro-Setup-<version>.exe`.
