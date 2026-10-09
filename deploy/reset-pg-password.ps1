# ============================================================================
# Reset the local PostgreSQL superuser (postgres) password.
# Standard recovery procedure for a server where the password was forgotten.
# Run ON THE VPS as Administrator. Only affects the 'postgres' role —
# other roles (e.g. the one the dossiro service uses) are untouched.
#
#   powershell -ExecutionPolicy Bypass -File C:\apps\kpi-platform\deploy\reset-pg-password.ps1
#
# How it works: pg_hba.conf is temporarily set to 'trust' for LOCALHOST
# connections only, Postgres is restarted, the password is changed, the
# original pg_hba.conf is restored and Postgres restarted again.
# ============================================================================

$ErrorActionPreference = 'Stop'

$hba = Get-ChildItem 'C:\Program Files\PostgreSQL\*\data\pg_hba.conf' -ErrorAction SilentlyContinue |
       Sort-Object FullName -Descending | Select-Object -First 1
if (-not $hba) { throw 'pg_hba.conf not found under C:\Program Files\PostgreSQL\*\data' }
$hba = $hba.FullName
$dataDir = Split-Path $hba

$pgSvc = Get-Service postgresql* | Select-Object -First 1
if (-not $pgSvc) { throw 'PostgreSQL service not found' }

$psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' |
        Sort-Object FullName -Descending | Select-Object -First 1 | ForEach-Object FullName

Write-Host "pg_hba.conf : $hba"
Write-Host "service     : $($pgSvc.Name)"

$newPass = Read-Host 'New password to set for the postgres user'
if (-not $newPass) { throw 'Empty password — aborting.' }

# ── 1. Backup and switch localhost lines to trust ───────────────────────────
$backup = "$hba.backup-before-reset"
Copy-Item $hba $backup -Force
Write-Host "Backup saved: $backup"

(Get-Content $hba) | ForEach-Object {
    if ($_ -match '^\s*host' -and $_ -match '(127\.0\.0\.1/32|::1/128)') {
        ($_ -replace '(scram-sha-256|md5|password)\s*$', 'trust')
    } else { $_ }
} | Set-Content $hba -Encoding ascii

Restart-Service $pgSvc.Name
Start-Sleep -Seconds 5

# ── 2. Set the new password ─────────────────────────────────────────────────
& $psql -U postgres -h 127.0.0.1 -d postgres -c "ALTER USER postgres PASSWORD '$($newPass -replace "'","''")'"
if ($LASTEXITCODE -ne 0) {
    Copy-Item $backup $hba -Force
    Restart-Service $pgSvc.Name
    throw 'ALTER USER failed — pg_hba.conf restored.'
}

# ── 3. Restore original auth config ─────────────────────────────────────────
Copy-Item $backup $hba -Force
Restart-Service $pgSvc.Name
Start-Sleep -Seconds 5

# ── 4. Verify ───────────────────────────────────────────────────────────────
$env:PGPASSWORD = $newPass
$ok = & $psql -U postgres -h 127.0.0.1 -d postgres -tAc 'SELECT 1'
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

if ("$ok".Trim() -eq '1') {
    Write-Host "`nPassword reset successful and verified." -ForegroundColor Green
    Write-Host 'Now run fix-db.ps1 and enter user "postgres" with the new password.'
} else {
    Write-Warning 'Verification failed — check pg_hba.conf and the service state.'
}
