# ============================================================================
# KPI Platform — diagnose why /api returns an error.
# Run ON THE VPS (any PowerShell, elevated):
#   powershell -ExecutionPolicy Bypass -File C:\apps\kpi-platform\deploy\diagnose-api.ps1
# Prints: pool state, site/app layout, node processes, node logs, the
# detailed IIS error for /api/health, recent IIS log lines, and recent
# HttpPlatformHandler events.
# ============================================================================

$ErrorActionPreference = 'Continue'
Import-Module WebAdministration

Write-Host "`n--- App pool state ---" -ForegroundColor Cyan
(Get-WebAppPoolState 'kpi-api').Value
(Get-WebAppPoolState 'kpi-web').Value

Write-Host "`n--- Sites and applications ---" -ForegroundColor Cyan
Get-Website | Select-Object name, state, physicalPath | Format-Table -AutoSize
Get-WebApplication | Select-Object @{n='site';e={$_.GetParentElement().Attributes['name'].Value}}, path, physicalPath, applicationPool | Format-Table -AutoSize

Write-Host "`n--- node.exe processes ---" -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Select-Object Id, StartTime, Path | Format-Table -AutoSize

Write-Host "`n--- Backend logs folder ---" -ForegroundColor Cyan
Get-ChildItem 'C:\apps\kpi-platform\backend\logs' -ErrorAction SilentlyContinue | Select-Object Name, Length, LastWriteTime
Get-ChildItem 'C:\apps\kpi-platform\backend\logs' -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "--- tail of $($_.Name) ---" -ForegroundColor Yellow
    Get-Content $_.FullName -Tail 20
}

Write-Host "`n--- GET /api/health (detailed error) ---" -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest 'http://kpi.calmglobal.com/api/health' -UseBasicParsing -TimeoutSec 30
    Write-Host "Status: $($r.StatusCode)"
    Write-Host $r.Content
} catch {
    $resp = $_.Exception.Response
    if ($resp -and $resp.GetType().Name -eq 'HttpWebResponse') {
        Write-Host "Status: $([int]$resp.StatusCode)"
        $body = (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd()
        # strip html tags for readability
        Write-Host (($body -replace '<[^>]+>', ' ') -replace '\s{2,}', "`n").Trim()
    } else {
        Write-Host $_.Exception.Message
    }
}

Write-Host "`n--- Last 10 IIS log lines mentioning /api ---" -ForegroundColor Cyan
$log = Get-ChildItem C:\inetpub\logs\LogFiles -Recurse -Filter *.log -ErrorAction SilentlyContinue |
       Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($log) {
    Write-Host $log.FullName
    Get-Content $log.FullName | Where-Object { $_ -match '/api' } | Select-Object -Last 10
}

Write-Host "`n--- Recent HttpPlatformHandler / IIS events ---" -ForegroundColor Cyan
Get-EventLog -LogName Application -Newest 300 -ErrorAction SilentlyContinue |
    Where-Object { $_.Source -match 'HttpPlatform|WAS|IIS' } |
    Select-Object -First 10 TimeGenerated, Source, EntryType, Message | Format-List
