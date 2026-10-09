# ============================================================================
# KPI Platform — install the Azure DevOps self-hosted build agent on the VPS.
# Run ON THE VPS as Administrator:
#   powershell -ExecutionPolicy Bypass -File C:\apps\kpi-platform\deploy\setup-agent.ps1
#
# Prerequisite: an Azure DevOps Personal Access Token (PAT) with the
# "Agent Pools (Read & manage)" scope. Create it at:
#   https://dev.azure.com/calmglobalkoko  ->  User settings (top right)
#   -> Personal access tokens -> New Token
# The PAT is only used by config.cmd to register the agent; it is not stored
# by this script.
# ============================================================================

$ErrorActionPreference = 'Stop'

$OrgUrl    = 'https://dev.azure.com/calmglobalkoko'
$Pool      = 'calm'   # pool owned by Lekan (Administrator role confirmed)
$AgentName = 'KPI-VPS'
$AgentDir  = 'C:\azagent'

if (Test-Path "$AgentDir\.agent") {
    Write-Host 'An agent is already configured in C:\azagent.' -ForegroundColor Yellow
    Write-Host 'To reconfigure, first run: cd C:\azagent; .\config.cmd remove'
    exit 0
}

# ── 1. Download the latest agent ────────────────────────────────────────────
Write-Host '==> Finding latest agent version' -ForegroundColor Cyan
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$rel = Invoke-RestMethod 'https://api.github.com/repos/microsoft/azure-pipelines-agent/releases/latest'
$ver = $rel.tag_name.TrimStart('v')
$zipUrl = "https://download.agent.dev.azure.com/agent/$ver/vsts-agent-win-x64-$ver.zip"
Write-Host "Agent version: $ver"

New-Item -ItemType Directory -Force -Path $AgentDir | Out-Null
$zip = "$AgentDir\agent.zip"
if (-not (Test-Path "$AgentDir\config.cmd")) {
    Write-Host "==> Downloading $zipUrl" -ForegroundColor Cyan
    Invoke-WebRequest $zipUrl -OutFile $zip
    Write-Host '==> Extracting' -ForegroundColor Cyan
    Expand-Archive $zip -DestinationPath $AgentDir -Force
    Remove-Item $zip
}

# ── 2. Configure as a Windows service running as SYSTEM ─────────────────────
# SYSTEM is needed so pipeline steps can manage IIS app pools and write to
# C:\apps. The PAT is typed here, passed straight to config.cmd.
$pat = Read-Host 'Paste your Azure DevOps PAT (scope: Agent Pools - Read & manage)'
if (-not $pat) { throw 'No PAT provided.' }

Push-Location $AgentDir
.\config.cmd --unattended `
    --url $OrgUrl `
    --auth pat --token $pat `
    --pool $Pool `
    --agent $AgentName `
    --runAsService `
    --windowsLogonAccount 'NT AUTHORITY\SYSTEM' `
    --acceptTeeEula
Pop-Location

# ── 3. Verify ───────────────────────────────────────────────────────────────
Start-Sleep -Seconds 3
$svc = Get-Service vstsagent* | Select-Object -First 1
if ($svc -and $svc.Status -eq 'Running') {
    Write-Host "`nAgent service '$($svc.Name)' is running." -ForegroundColor Green
    Write-Host "Check it appears online at: $OrgUrl/_settings/agentpools" -ForegroundColor Green
} else {
    Write-Warning 'Agent service not found or not running — check the config.cmd output above.'
}
