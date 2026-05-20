# Start frontend (run from repo root)
Write-Host "Starting ResumeAlchemyst Frontend..." -ForegroundColor Cyan

$frontendDir = Join-Path $PSScriptRoot ".." "frontend"
Set-Location $frontendDir

if (-not (Test-Path ".env.local")) {
    Write-Host "Creating .env.local from example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env.local"
}

Write-Host "Frontend running at http://localhost:3000" -ForegroundColor Green
npm run dev
