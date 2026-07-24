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

# commit-msg hook: enforce Conventional Commits (so semantic-release can version).
$commitMsgContent = @"
#!/bin/sh
export PATH="`$PATH:/c/Program Files/nodejs"
npx --no -- commitlint --edit "`$1"
"@

# pre-push hook: keep the default branch PR-only even before remote rules run.
# This is a local convenience guardrail; the GitHub ruleset is authoritative.
$prePushContent = @"
#!/bin/sh
while read local_ref local_sha remote_ref remote_sha
do
  if [ "`$remote_ref" = "refs/heads/main" ]; then
    echo "[Pre-Push ERROR] Direct pushes to main are blocked. Push a feature branch and open a pull request."
    exit 1
  fi
done

exit 0
"@

$repoRoot = Split-Path -Parent $PSScriptRoot
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# Write hooks UTF-8 WITHOUT BOM and with LF, otherwise /bin/sh cannot exec the
# shebang ("cannot spawn .git/hooks/<hook>: No such file or directory").
$preCommitPath = Join-Path $repoRoot ".git\hooks\pre-commit"
[System.IO.File]::WriteAllText($preCommitPath, ($hookContent -replace "`r`n", "`n"), $utf8NoBom)
Write-Host "Git pre-commit hook installed at $preCommitPath"

$commitMsgPath = Join-Path $repoRoot ".git\hooks\commit-msg"
[System.IO.File]::WriteAllText($commitMsgPath, ($commitMsgContent -replace "`r`n", "`n"), $utf8NoBom)
Write-Host "Git commit-msg hook installed at $commitMsgPath"

$prePushPath = Join-Path $repoRoot ".git\hooks\pre-push"
[System.IO.File]::WriteAllText($prePushPath, ($prePushContent -replace "`r`n", "`n"), $utf8NoBom)
Write-Host "Git pre-push hook installed at $prePushPath"
