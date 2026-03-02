# Build script for Tally Arbiter Blink(1) Listener (Windows)
# Creates a standalone executable.
#
# Usage:
#   .\build.ps1              - build
#   .\build.ps1 -Clean       - remove dist/, build/ and .venv, then rebuild

param(
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

$Python = if ($env:PYTHON) { $env:PYTHON } else { "python" }
$VenvDir = ".venv"

Write-Host "==> Platform: Windows"
Write-Host "==> Python:   $(& $Python --version)"

if ($Clean) {
    Write-Host "==> Cleaning previous build artefacts..."
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue dist, build, $VenvDir
}

# Create or reuse virtual environment
if (-not (Test-Path $VenvDir)) {
    Write-Host "==> Creating virtual environment in $VenvDir..."
    & $Python -m venv $VenvDir
}

# Activate the virtual environment
& "$VenvDir\Scripts\Activate.ps1"

Write-Host "==> Python (venv): $(python --version)"

# Install Python runtime dependencies
Write-Host "==> Installing runtime dependencies..."
pip install -r requirements.txt

# Install PyInstaller (build-only dependency)
Write-Host "==> Installing PyInstaller..."
pip install pyinstaller

# Build using the spec file
Write-Host "==> Building executable..."
pyinstaller --clean -y blink1-listener.spec

Write-Host ""
Write-Host "==> Done! Windows executable:"
Write-Host "    dist\blink1-listener.exe"
