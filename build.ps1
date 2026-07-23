# VeloSys Pro - Production Build Script

$projectDir = $PSScriptRoot
if (-not $projectDir) { $projectDir = Get-Location }

$csproj = Join-Path $projectDir "desktop\VeloSysPro.csproj"

# 1. Add Node.js & .NET SDK to environment PATH
$env:Path += ";C:\Program Files\nodejs;C:\Program Files\dotnet"

# 2. Build React 18 + TypeScript + TailwindCSS + Rosetta (Vite) into ui/
$npm = Get-Command npm -ErrorAction SilentlyContinue
if ($npm) {
    Write-Host "Compilando Frontend React 18 + TypeScript + TailwindCSS + Rosetta (Vite)..." -ForegroundColor Yellow
    & $npm.Path run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Falha no build do frontend (Vite). Abortando." -ForegroundColor Red
        exit 1
    }
}

# 3. Kill running process if locked
Stop-Process -Name VeloSysPro -ErrorAction SilentlyContinue

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Compilando VeloSys Pro (.NET 8 WPF + Edge Chromium)..." -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$distDir = Join-Path $projectDir "dist"
Remove-Item -Recurse -Force $distDir -ErrorAction SilentlyContinue

# 4. Publish a genuinely single, self-contained VeloSysPro.exe (ui/ is embedded,
#    WebView2Loader.dll is bundled via IncludeNativeLibrariesForSelfExtract).
& dotnet publish "$csproj" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o "$distDir"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Falha no dotnet publish. Abortando." -ForegroundColor Red
    exit 1
}

# 5. Copy ONLY the single executable to the project root for direct execution.
Copy-Item (Join-Path $distDir "VeloSysPro.exe") $projectDir -Force -ErrorAction SilentlyContinue

# 6. Sanitize: never leave loose build artifacts in the root (AGENTS.md guardrail).
Get-ChildItem -Path $projectDir -Filter *.pdb -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path $projectDir -Filter *.deps.json -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path $projectDir -Filter WebView2Loader.dll -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

$rootExe = Join-Path $projectDir "VeloSysPro.exe"
if (Test-Path $rootExe) {
    $file = Get-Item $rootExe
    Write-Host ""
    Write-Host "SUCESSO DE COMPILAÇÃO!" -ForegroundColor Green
    Write-Host "Executável Único: $($file.FullName)" -ForegroundColor Green
    Write-Host "Tamanho: $([math]::Round($file.Length / 1MB, 2)) MB" -ForegroundColor Green
}
else {
    Write-Host "AVISO: VeloSysPro.exe não foi encontrado na raiz após o publish." -ForegroundColor Red
}
