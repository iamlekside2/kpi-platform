# ============================================================================
# KPI Platform — redeploy after code changes.
# Run ON THE VPS as Administrator whenever new commits are pushed to GitHub.
#
#   powershell -ExecutionPolicy Bypass -File deploy-update.ps1
# ============================================================================

$ErrorActionPreference = 'Stop'
$AppRoot = 'C:\apps\kpi-platform'

Import-Module WebAdministration

Write-Host '==> Pulling latest code' -ForegroundColor Cyan
git -C $AppRoot pull

Write-Host '==> Backend: install + migrate' -ForegroundColor Cyan
Push-Location "$AppRoot\backend"
npm ci
npx prisma migrate deploy
Pop-Location
Copy-Item "$AppRoot\deploy\backend.web.config" "$AppRoot\backend\web.config" -Force

Write-Host '==> Frontend: build' -ForegroundColor Cyan
Push-Location "$AppRoot\frontend"
npm ci
npm run build
Pop-Location
Copy-Item "$AppRoot\deploy\frontend.web.config" "$AppRoot\frontend\dist\web.config" -Force

Write-Host '==> Restarting backend' -ForegroundColor Cyan
Restart-WebAppPool 'kpi-api'

Write-Host 'Done. Check https://kpi.calmglobal.com/api/health' -ForegroundColor Green
