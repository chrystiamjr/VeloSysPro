[CmdletBinding()]
param(
    [string]$Repository
)

$ErrorActionPreference = "Stop"

function Resolve-GitHubCli {
    $command = Get-Command gh -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $installedPath = "C:\Program Files\GitHub CLI\gh.exe"
    if (Test-Path -LiteralPath $installedPath) {
        return $installedPath
    }

    throw "GitHub CLI was not found. Install it and restart the terminal."
}

function Invoke-GitHubCli {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

    & $script:GitHubCli @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "GitHub CLI failed: gh $($Arguments -join ' ')"
    }
}

function Write-JsonFile {
    param(
        [Parameter(Mandatory)][object]$Value,
        [Parameter(Mandatory)][string]$Path
    )

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $json = $Value | ConvertTo-Json -Depth 20
    [System.IO.File]::WriteAllText($Path, $json, $utf8NoBom)
}

$script:GitHubCli = Resolve-GitHubCli
Invoke-GitHubCli auth status

if (-not $Repository) {
    $Repository = (& $script:GitHubCli repo view --json nameWithOwner --jq ".nameWithOwner").Trim()
    if ($LASTEXITCODE -ne 0 -or -not $Repository) {
        throw "Could not determine the GitHub repository. Pass -Repository owner/name."
    }
}

$rulesetName = "Protect default branch"
$rulesetPayload = @{
    name = $rulesetName
    target = "branch"
    enforcement = "active"
    bypass_actors = @(
        @{
            actor_id = 5
            actor_type = "RepositoryRole"
            bypass_mode = "pull_request"
        }
    )
    conditions = @{
        ref_name = @{
            include = @("~DEFAULT_BRANCH")
            exclude = @()
        }
    }
    rules = @(
        @{ type = "deletion" },
        @{ type = "non_fast_forward" },
        @{ type = "required_linear_history" },
        @{
            type = "pull_request"
            parameters = @{
                allowed_merge_methods = @("squash")
                dismiss_stale_reviews_on_push = $true
                require_code_owner_review = $true
                require_last_push_approval = $false
                required_approving_review_count = 1
                required_review_thread_resolution = $true
            }
        },
        @{
            type = "required_status_checks"
            parameters = @{
                do_not_enforce_on_create = $true
                required_status_checks = @(
                    @{ context = "Frontend (validate + E2E)" },
                    @{ context = "Desktop (.NET 8 build + test)" }
                )
                strict_required_status_checks_policy = $true
            }
        }
    )
}

$repositoryPayload = @{
    allow_auto_merge = $true
    allow_merge_commit = $false
    allow_rebase_merge = $false
    allow_squash_merge = $true
    allow_update_branch = $true
    delete_branch_on_merge = $true
    squash_merge_commit_message = "PR_BODY"
    squash_merge_commit_title = "PR_TITLE"
}

$workflowPermissionsPayload = @{
    default_workflow_permissions = "read"
    can_approve_pull_request_reviews = $false
}

$rulesetFile = [System.IO.Path]::GetTempFileName()
$repositoryFile = [System.IO.Path]::GetTempFileName()
$workflowPermissionsFile = [System.IO.Path]::GetTempFileName()

try {
    Write-JsonFile -Value $rulesetPayload -Path $rulesetFile
    Write-JsonFile -Value $repositoryPayload -Path $repositoryFile
    Write-JsonFile -Value $workflowPermissionsPayload -Path $workflowPermissionsFile

    $existingRulesets = & $script:GitHubCli api "repos/$Repository/rulesets" | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) {
        throw "Could not inspect repository rulesets."
    }

    $existingRuleset = $existingRulesets | Where-Object { $_.name -eq $rulesetName } | Select-Object -First 1
    if ($existingRuleset) {
        Invoke-GitHubCli api --method PUT "repos/$Repository/rulesets/$($existingRuleset.id)" --input $rulesetFile
        Write-Host "Updated ruleset '$rulesetName'."
    }
    else {
        Invoke-GitHubCli api --method POST "repos/$Repository/rulesets" --input $rulesetFile
        Write-Host "Created ruleset '$rulesetName'."
    }

    Invoke-GitHubCli api --method PATCH "repos/$Repository" --input $repositoryFile
    Invoke-GitHubCli api --method PUT "repos/$Repository/actions/permissions/workflow" --input $workflowPermissionsFile

    Write-Host "Repository merge and workflow permission settings updated."
    Invoke-GitHubCli ruleset check --default --repo $Repository
}
finally {
    Remove-Item -LiteralPath $rulesetFile, $repositoryFile, $workflowPermissionsFile -Force -ErrorAction SilentlyContinue
}
