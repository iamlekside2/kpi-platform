# ============================================================================
# KPI Platform — one-time IIS server setup
# Run ON THE VPS (158.69.198.49) in an ELEVATED PowerShell session.
#
#   powershell -ExecutionPolicy Bypass -File setup-server.ps1
#
# What it does:
#   1. Installs Node.js LTS, Git, IIS URL Rewrite, HttpPlatformHandler (if missing)
#   2. Clones/updates the repo into C:\apps\kpi-platform
#   3. Backend: creates .env (auto-generates JWT secrets), npm ci,
#      creates the kpi_platform database, runs prisma migrations
#   4. Frontend: npm ci + production build
#   5. Creates ONE IIS site, kpi.calmglobal.com:
#        /     -> static SPA (frontend/dist)
#        /api  -> Node backend sub-application via HttpPlatformHandler
#   6. Leaves HTTPS to get-ssl.ps1 (run after DNS points here)
# ============================================================================

$ErrorActionPreference = 'Stop'

# ── Config ──────────────────────────────────────────────────────────────────
$RepoUrl  = 'https://github.com/iamlekside2/kpi-platform.git'
$AppRoot  = 'C:\apps\kpi-platform'
$WebHost  = 'kpi.calmglobal.com'
$DbName   = 'kpi_platform'

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this script as Administrator.'
}

# ── 1. Prerequisites ────────────────────────────────────────────────────────
Step 'Checking IIS'
if (-not (Test-Path "$env:windir\System32\inetsrv\appcmd.exe")) {
    Step 'Installing IIS'
    Install-WindowsFeature Web-Server, Web-Static-Content, Web-Default-Doc, Web-Http-Errors, Web-Http-Logging, Web-Stat-Compression | Out-Null
}
Import-Module WebAdministration

Step 'Checking Node.js'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Step 'Installing Node.js LTS'
    $index = Invoke-RestMethod 'https://nodejs.org/dist/index.json'
    $lts = $index | Where-Object { $_.lts } | Select-Object -First 1
    $msi = "$env:TEMP\node-$($lts.version)-x64.msi"
    Invoke-WebRequest "https://nodejs.org/dist/$($lts.version)/node-$($lts.version)-x64.msi" -OutFile $msi
    Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn" -Wait
    $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
}
node -v

Step 'Checking Git'
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
    Step 'Installing Git (MinGit)'
    $rel = Invoke-RestMethod 'https://api.github.com/repos/git-for-windows/git/releases/latest'
    $asset = $rel.assets | Where-Object { $_.name -like 'MinGit-*-64-bit.zip' } | Select-Object -First 1
    $zip = "$env:TEMP\mingit.zip"
    Invoke-WebRequest $asset.browser_download_url -OutFile $zip
    Expand-Archive $zip -DestinationPath 'C:\tools\mingit' -Force
    $env:Path += ';C:\tools\mingit\cmd'
    [Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path','Machine') + ';C:\tools\mingit\cmd', 'Machine')
}
git --version

Step 'Checking IIS URL Rewrite module'
if (-not (Test-Path "$env:windir\System32\inetsrv\rewrite.dll")) {
    Step 'Installing URL Rewrite'
    $msi = "$env:TEMP\rewrite_amd64.msi"
    Invoke-WebRequest 'https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi' -OutFile $msi
    Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn" -Wait
}

Step 'Checking HttpPlatformHandler'
if (-not (Test-Path "$env:windir\System32\inetsrv\HttpPlatformHandler.dll")) {
    Step 'Installing HttpPlatformHandler'
    $msi = "$env:TEMP\httpPlatformHandler_amd64.msi"
    Invoke-WebRequest 'https://go.microsoft.com/fwlink/?LinkId=690721' -OutFile $msi
    Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn" -Wait
}

# ── 2. Get the code ─────────────────────────────────────────────────────────
Step "Fetching repo into $AppRoot"
if (Test-Path "$AppRoot\.git") {
    git -C $AppRoot pull
} else {
    New-Item -ItemType Directory -Force -Path (Split-Path $AppRoot) | Out-Null
    git clone $RepoUrl $AppRoot
}

# ── 3. Backend ──────────────────────────────────────────────────────────────
$backend = "$AppRoot\backend"

Step 'Backend .env'
$envFile = "$backend\.env"
if (-not (Test-Path $envFile)) {
    Copy-Item "$AppRoot\deploy\backend.env.example" $envFile
}
# generate JWT secrets where placeholders remain
$envText = Get-Content $envFile -Raw
while ($envText -match 'GENERATE_ME') {
    $bytes = New-Object byte[] 48
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $secret = [Convert]::ToBase64String($bytes) -replace '[/+=]',''
    $rx = New-Object System.Text.RegularExpressions.Regex 'GENERATE_ME'
    $envText = $rx.Replace($envText, $secret, 1)
}
Set-Content $envFile $envText -Encoding ascii

if ($envText -match 'CHANGE_ME_DB_PASSWORD') {
    Write-Host ''
    $dbPass = Read-Host 'Enter the password for the local postgres user (stored in backend\.env)'
    $envText = $envText -replace 'CHANGE_ME_DB_PASSWORD', $dbPass
    Set-Content $envFile $envText -Encoding ascii
}

Step 'Creating database if missing'
$dbUrl = ($envText -split "`n" | Where-Object { $_ -match '^DATABASE_URL=' }) -replace '^DATABASE_URL=',''
if ($dbUrl -match 'postgresql://([^:]+):([^@]+)@([^:/]+):(\d+)/([^?\s]+)') {
    $pgUser = $Matches[1]; $pgPass = $Matches[2]; $pgHost = $Matches[3]; $pgPort = $Matches[4]
    $psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
    if ($psql) {
        $env:PGPASSWORD = $pgPass
        $exists = & $psql.FullName -U $pgUser -h $pgHost -p $pgPort -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DbName'"
        if ($exists -ne '1') { & $psql.FullName -U $pgUser -h $pgHost -p $pgPort -d postgres -c "CREATE DATABASE $DbName" }
        Remove-Item Env:\PGPASSWORD
    } else {
        Write-Warning 'psql.exe not found under C:\Program Files\PostgreSQL — create the database manually if it does not exist.'
    }
}

Step 'Backend npm install'
Push-Location $backend
npm ci
Step 'Prisma migrate deploy'
npx prisma migrate deploy
Pop-Location

Step 'Backend web.config + logs folder'
Copy-Item "$AppRoot\deploy\backend.web.config" "$backend\web.config" -Force
New-Item -ItemType Directory -Force -Path "$backend\logs" | Out-Null

# ── 4. Frontend build ───────────────────────────────────────────────────────
Step 'Frontend npm install + build'
Push-Location "$AppRoot\frontend"
npm ci
npm run build
Pop-Location
Copy-Item "$AppRoot\deploy\frontend.web.config" "$AppRoot\frontend\dist\web.config" -Force

# ── 5. IIS sites ────────────────────────────────────────────────────────────
Step 'Creating app pools'
foreach ($pool in 'kpi-api','kpi-web') {
    if (-not (Test-Path "IIS:\AppPools\$pool")) { New-WebAppPool $pool | Out-Null }
    Set-ItemProperty "IIS:\AppPools\$pool" managedRuntimeVersion ''
}
# keep the Node process (and its sync scheduler) alive permanently
Set-ItemProperty 'IIS:\AppPools\kpi-api' -Name startMode -Value 'AlwaysRunning'
Set-ItemProperty 'IIS:\AppPools\kpi-api' -Name processModel.idleTimeout -Value ([TimeSpan]::Zero)

Step 'Creating site (SPA at /, backend at /api)'
if (-not (Get-Website -Name 'KPI-Web' -ErrorAction SilentlyContinue)) {
    New-Website -Name 'KPI-Web' -PhysicalPath "$AppRoot\frontend\dist" -ApplicationPool 'kpi-web' -HostHeader $WebHost -Port 80 | Out-Null
} else {
    Set-ItemProperty 'IIS:\Sites\KPI-Web' -Name physicalPath -Value "$AppRoot\frontend\dist"
}

if (-not (Get-WebApplication -Site 'KPI-Web' -Name 'api' -ErrorAction SilentlyContinue)) {
    New-WebApplication -Site 'KPI-Web' -Name 'api' -PhysicalPath $backend -ApplicationPool 'kpi-api' | Out-Null
} else {
    Set-ItemProperty 'IIS:\Sites\KPI-Web\api' -Name physicalPath -Value $backend
}
# preload so the Node process (and sync scheduler) starts with IIS, not on first hit
Set-ItemProperty 'IIS:\Sites\KPI-Web\api' -Name preloadEnabled -Value $true

Step 'File permissions for app pool identities'
icacls $AppRoot /grant 'IIS_IUSRS:(OI)(CI)RX' /T /Q | Out-Null
icacls "$backend\logs" /grant 'IIS_IUSRS:(OI)(CI)M' /Q | Out-Null

Step 'Starting site'
Start-Website 'KPI-Web'

Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Write-Host ' Setup complete.' -ForegroundColor Green
Write-Host ''
Write-Host ' DNS: kpi.calmglobal.com already points at this server.'
Write-Host ' Next: run get-ssl.ps1 to issue the Let''s Encrypt certificate (HTTPS),'
Write-Host ' then test:'
Write-Host '   https://kpi.calmglobal.com/api/health'
Write-Host '   https://kpi.calmglobal.com'
Write-Host '============================================================' -ForegroundColor Green
