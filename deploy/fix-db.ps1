# ============================================================================
# KPI Platform — fix database credentials and finish DB setup.
# Run ON THE VPS as Administrator after setup-server.ps1 reported
# "password authentication failed for user postgres".
#
#   powershell -ExecutionPolicy Bypass -File C:\apps\kpi-platform\deploy\fix-db.ps1
#
# Prompts for Postgres credentials, VERIFIES them with psql before writing
# anything, then updates backend\.env, creates the kpi_platform database,
# runs migrations, restarts the backend and health-checks it.
#
# Tip: if you don't remember the postgres password, another app on this
# server that already uses Postgres (e.g. dossiro-api) has a working
# DATABASE_URL in its .env file — the password in there is the one to use.
# ============================================================================

$ErrorActionPreference = 'Stop'

$AppRoot = 'C:\apps\kpi-platform'
$DbName  = 'kpi_platform'
$envFile = "$AppRoot\backend\.env"

$psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
if (-not $psql) { throw 'psql.exe not found under C:\Program Files\PostgreSQL' }
$psql = $psql.FullName

function Test-PgLogin($user, $pass) {
    $env:PGPASSWORD = $pass
    $out = & $psql -U $user -h localhost -p 5432 -d postgres -tAc 'SELECT 1' 2>&1
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    return ("$out".Trim() -eq '1')
}

# ── 1. Ask + verify ─────────────────────────────────────────────────────────
$found = $null
while (-not $found) {
    Write-Host ''
    $user = Read-Host 'Postgres username (press Enter for "postgres")'
    if (-not $user) { $user = 'postgres' }
    $pass = Read-Host "Password for '$user'"
    if (Test-PgLogin $user $pass) {
        $found = @{ User = $user; Pass = $pass }
    } else {
        Write-Warning 'Login failed — try again (Ctrl+C to abort).'
    }
}
Write-Host "`nCredentials verified for user '$($found.User)'." -ForegroundColor Green

# ── 2. Write backend\.env ───────────────────────────────────────────────────
$newUrl = "postgresql://$($found.User):$($found.Pass)@localhost:5432/$DbName"
$envText = Get-Content $envFile -Raw
$envText = $envText -replace '(?m)^DATABASE_URL=.*$', "DATABASE_URL=$newUrl"
Set-Content $envFile $envText -Encoding ascii
Write-Host 'backend\.env updated.'

# ── 3. Create database, migrate, restart ────────────────────────────────────
$env:PGPASSWORD = $found.Pass
$exists = & $psql -U $found.User -h localhost -p 5432 -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DbName'"
if ("$exists".Trim() -ne '1') {
    & $psql -U $found.User -h localhost -p 5432 -d postgres -c "CREATE DATABASE $DbName"
    Write-Host "Database $DbName created."
}
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

Write-Host '==> prisma migrate deploy' -ForegroundColor Cyan
Push-Location "$AppRoot\backend"
npx prisma migrate deploy
Pop-Location

Import-Module WebAdministration
Restart-WebAppPool 'kpi-api'
Start-Sleep -Seconds 3

Write-Host '==> Health check' -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest 'http://kpi.calmglobal.com/api/health' -UseBasicParsing -TimeoutSec 30
    Write-Host "API health: $($r.Content)" -ForegroundColor Green
} catch {
    Write-Warning "Health check failed: $($_.Exception.Message)"
    Write-Warning "Check C:\apps\kpi-platform\backend\logs\node*.log"
}
