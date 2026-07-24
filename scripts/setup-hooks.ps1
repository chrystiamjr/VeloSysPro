# Setup Git Pre-Commit Hook for VeloSys Pro Full-Stack Validation
$hookContent = @"
#!/bin/sh
echo "[Pre-Commit] Executing full-stack validation (Frontend TS + Backend C#)..."
export PATH="`$PATH:/c/Program Files/nodejs"

npm run validate
FRONTEND_EXIT=`$?

if [ `$FRONTEND_EXIT -ne 0 ]; then
  echo "[Pre-Commit ERROR] Frontend validation failed!"
  exit 1
fi

dotnet build desktop/VeloSysPro.csproj --configuration Debug
BACKEND_EXIT=`$?

if [ `$BACKEND_EXIT -ne 0 ]; then
  echo "[Pre-Commit ERROR] C# .NET Backend build failed!"
  exit 1
fi

echo "[Pre-Commit SUCCESS] Full-stack validation passed successfully."
exit 0
"@

$repoRoot = Split-Path -Parent $PSScriptRoot
$hookPath = Join-Path $repoRoot ".git\hooks\pre-commit"
# Write UTF-8 WITHOUT BOM and with LF line endings, otherwise /bin/sh cannot exec
# the shebang ("cannot spawn .git/hooks/pre-commit: No such file or directory").
$hookContent = $hookContent -replace "`r`n", "`n"
[System.IO.File]::WriteAllText($hookPath, $hookContent, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Git pre-commit hook installed at $hookPath"
