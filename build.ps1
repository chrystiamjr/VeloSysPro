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

# 7. Build the Inno Setup installer if ISCC is available.
$iss = Join-Path $projectDir "installer\VeloSysPro.iss"
$iscc = $null
$isccCandidates = @(
    (Get-Command ISCC.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe"
)
foreach ($c in $isccCandidates) { if ($c -and (Test-Path $c)) { $iscc = $c; break } }

if ($iscc -and (Test-Path $iss)) {
    # Read the version from package.json so exe/installer stay aligned.
    $ver = "1.0.0"
    try { $ver = (Get-Content (Join-Path $projectDir "package.json") -Raw | ConvertFrom-Json).version } catch {}
    Write-Host ""
    Write-Host "Gerando instalador Inno Setup (v$ver)..." -ForegroundColor Cyan
    & $iscc "/DAppVersion=$ver" "$iss"
    $setup = Join-Path $distDir "VeloSysPro-Setup-$ver.exe"
    if (Test-Path $setup) {
        Write-Host "Instalador criado: $setup" -ForegroundColor Green
    }
}
else {
    Write-Host "Inno Setup (ISCC) não encontrado - pulando geração do instalador." -ForegroundColor DarkYellow
}
