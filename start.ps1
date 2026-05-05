# Basis — start backend, frontend, and ngrok tunnel
$root = $PSScriptRoot

Write-Host "Starting backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; node server.js"

Start-Sleep -Seconds 2

Write-Host "Starting frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npx vite"

Start-Sleep -Seconds 3

Write-Host "Starting ngrok tunnel on port 5173..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "ngrok http --domain=appendix-irritant-headsman.ngrok-free.dev 5173"

Write-Host ""
Write-Host "All three windows are open." -ForegroundColor Green
Write-Host "Your Basis URL: https://appendix-irritant-headsman.ngrok-free.dev" -ForegroundColor Green
Write-Host "Open that link on any device." -ForegroundColor Yellow
