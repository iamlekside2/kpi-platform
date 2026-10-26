# ============================================================================
# KPI Platform — called by azure-pipelines.yml on the VPS self-hosted agent.
# Copies the freshly built checkout into the live IIS folders and restarts
# the backend. Assumes setup-server.ps1 was run once before (sites exist,
# backend\.env exists in the live folder).
# ============================================================================

$ErrorActionPreference = 'Stop'

$Live = 'C:\apps\kpi-platform'
$Src  = (Get-Location).Path   # pipeline working directory = repo checkout

Import-Module WebAdministration

Write-Host '==> Stopping backend app pool'
if ((Get-WebAppPoolState 'kpi-api').Value -eq 'Started') { Stop-WebAppPool 'kpi-api' }
# give the node process a moment to exit and release file locks
Start-Sleep -Seconds 5

# Everything between here and the finally runs with the API down. Whatever
# happens, the pool is started again before this script exits — a failed
# deploy should fail the build, not leave production serving 503s.
$deployError = $null
try {

Write-Host '==> Syncing backend'
# /MIR mirrors the checkout; exclude the live-only files (.env, logs)
robocopy "$Src\backend" "$Live\backend" /MIR /NFL /NDL /NJH /NJS `
    /XF .env `
    /XD logs
if ($LASTEXITCODE -ge 8) { throw "robocopy backend failed with code $LASTEXITCODE" }
Copy-Item "$Src\deploy\backend.web.config" "$Live\backend\web.config" -Force
New-Item -ItemType Directory -Force -Path "$Live\backend\logs" | Out-Null

Write-Host '==> Syncing frontend'
robocopy "$Src\frontend\dist" "$Live\frontend\dist" /MIR /NFL /NDL /NJH /NJS
if ($LASTEXITCODE -ge 8) { throw "robocopy frontend failed with code $LASTEXITCODE" }
Copy-Item "$Src\deploy\frontend.web.config" "$Live\frontend\dist\web.config" -Force

Write-Host '==> Syncing database schema'
Push-Location "$Live\backend"
# The repo's migration history is incomplete (schema was evolved with db push),
# so deploy with db push: it diffs the live DB against schema.prisma and fails
# loudly instead of applying destructive changes.
npx prisma db push --skip-generate
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    throw @'
prisma db push failed.

If the log above says the change cannot be executed without data loss, that
is this guard doing its job: a column or table is being dropped. Review the
change, then apply it deliberately on the VPS:

  cd C:\apps\kpi-platform\backend
  npx prisma db push --skip-generate --accept-data-loss

and re-run the pipeline. Do not add --accept-data-loss to this script; it
would let any future schema slip drop live data unattended.
'@
}
Pop-Location

}
catch {
    $deployError = $_
}
finally {
    Write-Host '==> Starting backend app pool'
    if ((Get-WebAppPoolState 'kpi-api').Value -ne 'Started') { Start-WebAppPool 'kpi-api' }
    Start-Sleep -Seconds 5
}

if ($deployError) {
    Write-Host 'Deploy failed — app pool restarted on the previous build.' -ForegroundColor Yellow
    throw $deployError
}

Write-Host '==> Health check'
$r = Invoke-WebRequest 'http://kpi.calmglobal.com/api/health' -UseBasicParsing -TimeoutSec 30
Write-Host "API health: $($r.Content)"
if ($r.StatusCode -ne 200) { throw 'Health check failed' }

Write-Host 'Deploy complete.' -ForegroundColor Green

# robocopy exit codes 0-7 mean success; reset so the pipeline step passes
exit 0
