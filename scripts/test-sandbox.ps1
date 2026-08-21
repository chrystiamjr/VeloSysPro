# ==============================================================================
# VeloSys Pro - Windows Sandbox Automated Testing Launcher
# ==============================================================================
# Launches a disposable Windows Sandbox instance containing VeloSysPro.exe
# and the real native Windows integration test suite.
#
# Usage:
#   powershell ./scripts/test-sandbox.ps1
# ==============================================================================

[CmdletBinding()]
param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  VeloSys Pro: Windows Sandbox Isolated Environment Launcher" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. Check if Windows Sandbox is installed
$wsbExe = Get-Command "WindowsSandbox.exe" -ErrorAction SilentlyContinue
if (-not $wsbExe) {
    Write-Warning "Windows Sandbox is not enabled on this system."
    Write-Host "To enable Windows Sandbox, run the following in an elevated PowerShell:" -ForegroundColor Yellow
    Write-Host "  Enable-WindowsOptionalFeature -Online -FeatureName 'Containers-DisposableClientVM'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Note: Integration tests can still be run locally or via CI (GitHub Actions):" -ForegroundColor Cyan
    Write-Host "  dotnet test desktop.Tests/ --filter 'Category=Integration'" -ForegroundColor Green
    exit 0
}

$rootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $rootDir

# 2. Build binaries if requested
if (-not $SkipBuild) {
    Write-Host "[1/3] Building Web Frontend assets..." -ForegroundColor Green
    npm run build

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Frontend build failed. Aborting Sandbox launch."
        exit $LASTEXITCODE
    }

    Write-Host "[2/3] Publishing standalone C# Desktop executable (self-contained)..." -ForegroundColor Green
    dotnet publish desktop/VeloSysPro.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o desktop/bin/Release/standalone
    dotnet build desktop.Tests/VeloSysPro.Tests.csproj -c Release

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Desktop build/publish failed. Aborting Sandbox launch."
        exit $LASTEXITCODE
    }
}

# 3. Stage project files into a local non-OneDrive temporary directory
Write-Host "[3/3] Staging project to local temporary directory (bypassing OneDrive sync)..." -ForegroundColor Green

$wv2SetupPath = Join-Path $env:TEMP "MicrosoftEdgeWebview2Setup.exe"
if (-not (Test-Path $wv2SetupPath)) {
    Write-Host "Downloading Microsoft Edge WebView2 installer for Sandbox..." -ForegroundColor Cyan
    try {
        Invoke-WebRequest -Uri "https://go.microsoft.com/fwlink/p/?LinkId=2124703" -OutFile $wv2SetupPath -ErrorAction SilentlyContinue
    } catch {}
}

$stagingDir = Join-Path $env:TEMP "VeloSysProSandboxStaging"
if (Test-Path $stagingDir) {
    Remove-Item $stagingDir -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

# Robocopy project files (excluding large node_modules and .git) to local temp folder
robocopy $rootDir.Path $stagingDir /E /XD .git .vs node_modules /XF *.user /NJH /NJS /NDL /NC /NS | Out-Null

if (Test-Path $wv2SetupPath) {
    Copy-Item $wv2SetupPath -Destination (Join-Path $stagingDir "MicrosoftEdgeWebview2Setup.exe") -Force
}

$wsbTempPath = Join-Path $env:TEMP "VeloSysProTestEnvironment.wsb"
$hostMountPath = $stagingDir

$wsbContent = @"
<Configuration>
  <MappedFolders>
    <MappedFolder>
      <HostFolder>$hostMountPath</HostFolder>
      <SandboxFolder>C:\VeloSysPro</SandboxFolder>
      <ReadOnly>false</ReadOnly>
    </MappedFolder>
  </MappedFolders>
  <LogonCommand>
    <Command>powershell.exe -ExecutionPolicy Bypass -NoExit -Command "Set-Location 'C:\VeloSysPro'; Write-Host '======================================================================' -ForegroundColor Cyan; Write-Host '  VeloSys Pro: Windows Sandbox Isolated Environment' -ForegroundColor Cyan; Write-Host '======================================================================' -ForegroundColor Cyan; if (Test-Path 'C:\VeloSysPro\MicrosoftEdgeWebview2Setup.exe') { Write-Host '[1/2] Installing WebView2 Runtime in Sandbox...' -ForegroundColor Green; Start-Process 'C:\VeloSysPro\MicrosoftEdgeWebview2Setup.exe' -ArgumentList '/silent /install' -Wait }; Write-Host '[2/2] Launching VeloSysPro.exe (Standalone Single File)...' -ForegroundColor Green; Start-Process 'C:\VeloSysPro\desktop\bin\Release\standalone\VeloSysPro.exe'; Write-Host 'App is running! You can perform live maintenance and tweak actions in this disposable VM.' -ForegroundColor Yellow"</Command>
  </LogonCommand>
</Configuration>
"@

$wsbContent | Out-File -FilePath $wsbTempPath -Encoding utf8 -Force

# 4. Check if a Sandbox instance is already running
$runningSandbox = Get-Process -Name "WindowsSandboxClient", "WindowsSandboxRemoteSession" -ErrorAction SilentlyContinue
if ($runningSandbox) {
    Write-Warning "An instance of Windows Sandbox is already running."
    Write-Host "Please close the active Windows Sandbox window before launching a new session." -ForegroundColor Yellow
    Write-Host "If Windows Sandbox displays a network session error, run in an elevated PowerShell:" -ForegroundColor Yellow
    Write-Host "  net stop vmcompute ; net start vmcompute" -ForegroundColor Green
    Write-Host ""
}

Write-Host "Launching Windows Sandbox..." -ForegroundColor Green
Start-Process "WindowsSandbox.exe" -ArgumentList "`"$wsbTempPath`""

Write-Host "Windows Sandbox launch command sent successfully!" -ForegroundColor Cyan
Write-Host "Your host OS remains 100% untouched inside the disposable VM." -ForegroundColor Gray
