#!/usr/bin/env bash
# Build script for Tally Arbiter Blink(1) Listener
# Creates a standalone executable for macOS or Linux.
#
# Usage:
#   ./build.sh              – build for the current platform
#   ./build.sh --clean      – remove dist/ and build/ before building
#
# Prerequisites (Linux):
#   sudo apt install libudev-dev libusb-1.0-0-dev
#   For the system tray: libgirepository1.0-dev gir1.2-appindicator3-0.1
#
# Prerequisites (macOS):
#   brew install libusb hidapi

set -euo pipefail

PLATFORM="$(uname -s)"
PYTHON="${PYTHON:-python3}"
VENV_DIR=".venv"

echo "==> Platform: $PLATFORM"
echo "==> Python:   $($PYTHON --version)"

# Optional --clean flag
if [[ "${1:-}" == "--clean" ]]; then
    echo "==> Cleaning previous build artefacts..."
    rm -rf dist/ build/ "$VENV_DIR"
fi

# Create or reuse virtual environment
if [[ ! -d "$VENV_DIR" ]]; then
    echo "==> Creating virtual environment in $VENV_DIR..."
    $PYTHON -m venv "$VENV_DIR"
fi

# Activate the virtual environment
# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"

echo "==> Python (venv): $(python --version)"

# Install Python runtime dependencies
echo "==> Installing runtime dependencies..."
pip install -r requirements.txt

# Remove platform-incompatible packages that may linger from a previous venv
if [[ "$PLATFORM" != "Linux" ]]; then
    pip uninstall -y pygobject 2>/dev/null || true
fi

# Install PyInstaller (build-only dependency)
echo "==> Installing PyInstaller..."
pip install pyinstaller

# Build using the spec file (handles platform differences automatically)
echo "==> Building executable..."
pyinstaller --clean -y blink1-listener.spec

# Ad-hoc code sign the .app so macOS allows it to run on other machines
# without a paid Apple Developer certificate. The dash ("-") means ad-hoc.
if [[ "$PLATFORM" == "Darwin" ]]; then
    echo "==> Ad-hoc signing .app bundle..."
    codesign --force --deep --sign - \
        "dist/Tally Arbiter Blink(1) Listener.app"
fi

echo ""
if [[ "$PLATFORM" == "Darwin" ]]; then
    echo "==> Done! macOS app bundle:"
    echo "    dist/Tally Arbiter Blink(1) Listener.app"
    echo ""
    echo "    To allow USB access for the Blink(1) device, the app may need to be"
    echo "    signed or run with 'Allow accessories to connect' in System Settings."
else
    echo "==> Done! Linux binary:"
    echo "    dist/blink1-listener"
    echo ""
    echo "    To run without sudo, add a udev rule for the Blink(1) device:"
    echo "    echo 'SUBSYSTEM==\"usb\", ATTR{idVendor}==\"27b8\", MODE=\"0666\"' | \\"
    echo "         sudo tee /etc/udev/rules.d/51-blink1.rules"
    echo "    sudo udevadm control --reload-rules && sudo udevadm trigger"
fi
