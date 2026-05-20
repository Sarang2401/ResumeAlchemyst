# Start backend (run from repo root)
Write-Host "Starting ResumeAlchemyst Backend..." -ForegroundColor Cyan

$backendDir = Join-Path $PSScriptRoot ".." "backend"
Set-Location $backendDir

# Create venv if it doesn't exist
if (-not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv .venv
}

# Activate venv
.\.venv\Scripts\Activate.ps1

# Install deps
Write-Host "Installing dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt --quiet

# Check for .env
if (-not (Test-Path ".env")) {
    Write-Host "WARNING: No .env file found. Copy .env.example to .env and add your API key." -ForegroundColor Red
    exit 1
}

Write-Host "Backend running at http://localhost:8000" -ForegroundColor Green
Write-Host "Swagger docs at http://localhost:8000/docs" -ForegroundColor Green
uvicorn main:app --reload --port 8000
