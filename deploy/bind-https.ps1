# ============================================================================
# KPI Platform — attach the Let's Encrypt certificate to the KPI-Web site.
# Run ON THE VPS as Administrator after get-ssl.ps1 reported the certificate
# was created (use this when the https binding wasn't added automatically).
#   powershell -ExecutionPolicy Bypass -File C:\apps\kpi-platform\deploy\bind-https.ps1
# ============================================================================

$ErrorActionPreference = 'Stop'
Import-Module WebAdministration

$Site = 'KPI-Web'
$HostName = 'kpi.calmglobal.com'

# find the newest cert for the hostname (win-acme stores in WebHosting)
$cert = Get-ChildItem Cert:\LocalMachine\WebHosting, Cert:\LocalMachine\My -ErrorAction SilentlyContinue |
        Where-Object { $_.Subject -match [regex]::Escape($HostName) -or ($_.DnsNameList -and ($_.DnsNameList.Unicode -contains $HostName)) } |
        Sort-Object NotAfter -Descending | Select-Object -First 1
if (-not $cert) { throw "No certificate found for $HostName in WebHosting/My stores." }

Write-Host "Using certificate: $($cert.Subject) (expires $($cert.NotAfter), thumbprint $($cert.Thumbprint))"
$store = $cert.PSParentPath -replace '.*\\',''

# add the https binding with SNI if missing
$binding = Get-WebBinding -Name $Site -Protocol https -HostHeader $HostName -ErrorAction SilentlyContinue
if (-not $binding) {
    New-WebBinding -Name $Site -Protocol https -Port 443 -HostHeader $HostName -SslFlags 1
    $binding = Get-WebBinding -Name $Site -Protocol https -HostHeader $HostName
    Write-Host "Added https binding for $HostName (SNI)."
} else {
    Write-Host 'https binding already exists.'
}

# attach the certificate
$binding.AddSslCertificate($cert.Thumbprint, $store)
Write-Host "Certificate attached from store '$store'."

Write-Host "`nTesting..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
try {
    $r = Invoke-WebRequest "https://$HostName/api/health" -UseBasicParsing -TimeoutSec 30
    Write-Host "HTTPS OK: $($r.Content)" -ForegroundColor Green
} catch {
    Write-Warning "HTTPS test failed: $($_.Exception.Message)"
}
