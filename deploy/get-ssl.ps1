# ============================================================================
# KPI Platform — issue Let's Encrypt certificates for the two IIS sites.
# Run ON THE VPS as Administrator, AFTER the DNS records for
# kpi-api.calmglobal.com and kpi.calmglobal.com point at this server.
#
#   powershell -ExecutionPolicy Bypass -File get-ssl.ps1
#
# Uses win-acme (free). It validates over HTTP (port 80 must be reachable,
# which it already is), installs the cert, adds the HTTPS bindings, and
# registers a scheduled task that renews automatically.
# ============================================================================

$ErrorActionPreference = 'Stop'

$ApiHost = 'kpi-api.calmglobal.com'
$WebHost = 'kpi.calmglobal.com'
$Email   = 'ootitolaye@calmglobal.com'   # Let's Encrypt expiry notices
$Dir     = 'C:\tools\win-acme'

if (-not (Test-Path "$Dir\wacs.exe")) {
    Write-Host '==> Downloading win-acme' -ForegroundColor Cyan
    $rel = Invoke-RestMethod 'https://api.github.com/repos/win-acme/win-acme/releases/latest'
    $asset = $rel.assets | Where-Object { $_.name -match 'win-acme.*x64\.pluggable\.zip$' } | Select-Object -First 1
    if (-not $asset) { $asset = $rel.assets | Where-Object { $_.name -match 'x64.*\.zip$' } | Select-Object -First 1 }
    $zip = "$env:TEMP\win-acme.zip"
    Invoke-WebRequest $asset.browser_download_url -OutFile $zip
    Expand-Archive $zip -DestinationPath $Dir -Force
}

Write-Host '==> Requesting certificate' -ForegroundColor Cyan
# --source iis reads the existing port-80 bindings for these hostnames and
# adds the matching HTTPS bindings after the cert is issued.
& "$Dir\wacs.exe" --source iis --host "$ApiHost,$WebHost" `
    --accepttos --emailaddress $Email

if ($LASTEXITCODE -ne 0) {
    Write-Warning 'Scripted mode failed — launching win-acme interactive menu instead.'
    Write-Warning 'Choose: N (new certificate) -> select the KPI-API and KPI-Web bindings.'
    & "$Dir\wacs.exe"
}

Write-Host ''
Write-Host 'If win-acme reported success, test:' -ForegroundColor Green
Write-Host "  https://$ApiHost/api/health"
Write-Host "  https://$WebHost"
