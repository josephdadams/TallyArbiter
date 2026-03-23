# Tally Arbiter – Blink(1) Listener

A cross-platform listener client for [Tally Arbiter](https://github.com/josephdadams/TallyArbiter) that drives a [blink(1)](https://blink1.thingm.com/) USB RGB indicator light based on live tally data.

Written in Python · MIT License · by Joseph Adams

---

## Overview

The blink(1) Listener connects to a Tally Arbiter 3.x server and lights up the blink(1) USB device in the color of the highest-priority active tally bus assigned to the configured device. When no tally is active the light turns off.

On desktop systems, a **system tray icon** mirrors the current color so you can see the tally state at a glance even when the blink(1) is not in sight. The listener can also be run completely headlessly on a Raspberry Pi or inside a Docker container.

---

## Features

| Feature                 | Details                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Tally color control** | Lights the blink(1) in the bus color defined in Tally Arbiter; priority-sorted when multiple buses are active |
| **mDNS auto-discovery** | Finds the Tally Arbiter server on the local network automatically; no IP address required                     |
| **Fixed host/port**     | Connect directly to a known address with `--host` / `--port`                                                  |
| **System tray icon**    | Color indicator in the system notification area on Linux (AppIndicator3), macOS, and Windows (pystray)        |
| **Device reassignment** | Server can move this listener to a different device from the Tally Arbiter UI                                 |
| **Flash command**       | Listener flashes white when triggered from the Tally Arbiter UI                                               |
| **Persistent config**   | `config.ini` stores host, port, device ID, and a stable client UUID across restarts                           |
| **Graceful shutdown**   | Responds to SIGTERM and SIGINT; suitable for systemd services                                                 |
| **Simulator mode**      | `--skip-blink1` runs without physical hardware for development and testing                                    |
| **Standalone binary**   | `build.sh` produces a self-contained executable via PyInstaller                                               |

---

## Requirements

### Hardware

- A [blink(1) mk2 or mk3](https://blink1.thingm.com/) USB device (optional – see Simulator mode)

### Software

| Platform                | System packages                                 |
| ----------------------- | ----------------------------------------------- |
| **Linux**               | `libudev-dev libusb-1.0-0-dev`                  |
| **Linux** (system tray) | `python3-gi gir1.2-ayatana-appindicator3-0.1` ¹ |
| **macOS**               | `libusb hidapi` (via Homebrew)                  |
| **Windows**             | no additional system packages required          |

¹ On older systems use `gir1.2-appindicator3-0.1` instead. Install via:

```bash
sudo apt install python3-gi gir1.2-ayatana-appindicator3-0.1
```

### Python packages

All Python dependencies are in `requirements.txt`:

```
blink1
python-socketio[client]
zeroconf
Pillow
pystray
pygobject
```

---

## Installation

### From source

```bash
# 1. Install system packages (Linux example)
sudo apt install libudev-dev libusb-1.0-0-dev

# 2. Clone or download the listener
wget https://raw.githubusercontent.com/josephdadams/TallyArbiter/master/listener_clients/blink1-listener/blink1-listener.py
wget https://raw.githubusercontent.com/josephdadams/TallyArbiter/master/listener_clients/blink1-listener/requirements.txt

# 3. Create a virtual environment and install Python dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

On a headless system (Raspberry Pi, server, Docker) you only need the core dependencies:

```bash
pip install blink1 "python-socketio[client]" zeroconf
```

The system tray packages (`Pillow`, `pystray`, `pygobject`) are optional and the listener will fall back to terminal-only mode if they are missing.

### Standalone binary (no Python required on target)

See [Building a standalone binary](#building-a-standalone-binary) below.

---

## Usage

When running from source, activate the virtual environment first:

```bash
source .venv/bin/activate
```

### Auto-discovery (recommended)

```bash
python3 blink1-listener.py
```

The listener broadcasts an mDNS query and connects to the first Tally Arbiter 3.x server it finds on the local network.

### Fixed server address

```bash
python3 blink1-listener.py --host 192.168.1.10 --port 4455
```

Providing `--host` or `--port` disables mDNS and connects directly. The values are persisted in `config.ini`.

### Headless / terminal-only mode

```bash
python3 blink1-listener.py --no-tray
```

Suppresses the system tray entirely. Useful on Raspberry Pi, servers, or inside containers. If the tray libraries are not installed, this mode is used automatically.

---

## Command-Line Reference

```
usage: blink1-listener.py [--host HOST] [--port PORT] [--device-id ID]
                           [--no-tray] [--disable-reassign] [--disable-flash]
                           [--disable-status-blink] [--skip-blink1] [--debug]
```

| Argument                 | Default     | Description                                                             |
| ------------------------ | ----------- | ----------------------------------------------------------------------- |
| `--host HOST`            | from config | Hostname or IP of the Tally Arbiter server. Setting this disables mDNS. |
| `--port PORT`            | from config | Server port (default `4455`). Setting this disables mDNS.               |
| `--device-id ID`         | from config | Tally Arbiter device ID to listen for.                                  |
| `--no-tray`              | off         | Disable the system tray; run in terminal-only mode.                     |
| `--disable-reassign`     | off         | Reject device reassignment requests from the server.                    |
| `--disable-flash`        | off         | Ignore flash commands from the server.                                  |
| `--disable-status-blink` | off         | Suppress connection status blinks (connect, disconnect, error).         |
| `--skip-blink1`          | off         | Use the built-in `Blink1Simulator` instead of a real device.            |
| `--debug`                | off         | Print verbose debug information.                                        |

---

## Configuration

On first launch, `config.ini` is created automatically in the working directory:

```ini
[DEFAULT]
deviceid =
host = localhost
port = 4455
usemdns = True
clientuuid = <auto-generated UUID>
```

| Key             | Description                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| `deviceid`      | Tally Arbiter device this listener is assigned to. Updated automatically on reassignment from the UI. |
| `host` / `port` | Fallback connection target when mDNS is disabled.                                                     |
| `usemdns`       | `True` by default; set to `False` automatically when `--host` or `--port` is provided.                |
| `clientuuid`    | Stable identifier for this listener instance. Generated once and never changed.                       |

The file is **not** tracked by git. Delete it to reset to defaults.

---

## System Tray

When the required libraries are available and `--no-tray` is not set, a tray icon appears in the system notification area.

**Icon states:**

| Icon             | Meaning                                            |
| ---------------- | -------------------------------------------------- |
| Colored circle   | Active tally – color matches the Tally Arbiter bus |
| Grey circle      | Connected, no active tally                         |
| Black background | Disconnected or device off                         |

The tray menu provides a single **Quit** entry for a clean shutdown.

**Platform notes:**

- **Linux** – Uses AppIndicator3 / AyatanaAppIndicator3 directly (GTK3). The `pystray` library is _not_ used on Linux because of a long-standing icon-not-showing bug on most desktop environments ([pystray#175](https://github.com/moses-palmer/pystray/issues/175)).
- **macOS** – Uses pystray backed by Cocoa. Runs as a menu-bar agent (no Dock icon).
- **Windows** – Uses pystray.

If the tray libraries are not installed, the listener falls back to terminal-only mode automatically and prints install instructions.

---

## Status Blinks

Unless `--disable-status-blink` is set, the blink(1) blinks to signal connection events:

| Event            | Blink pattern  |
| ---------------- | -------------- |
| Connected        | 2x green flash |
| Reconnected      | 2x green flash |
| Disconnected     | 1x white flash |
| Connection error | 1x grey flash  |

---

## blink(1) USB Access Without `sudo`

On Linux, USB access requires elevated privileges by default. Add a udev rule to allow access for all users:

```bash
echo 'SUBSYSTEM=="usb", ATTR{idVendor}=="27b8", MODE="0666"' | \
    sudo tee /etc/udev/rules.d/51-blink1.rules
sudo udevadm control --reload-rules && sudo udevadm trigger
```

Unplug and reconnect the blink(1) after applying the rule.

---

## Running as a systemd Service

Create `/etc/systemd/system/blink1-listener.service`:

```ini
[Unit]
Description=Tally Arbiter Blink(1) Listener
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/home/pi/blink1-listener/.venv/bin/python /home/pi/blink1-listener/blink1-listener.py --no-tray
WorkingDirectory=/home/pi/blink1-listener
Restart=on-failure
RestartSec=10
User=pi

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now blink1-listener

# View live log
journalctl -u blink1-listener -f
```

Adjust `User=` and the paths as needed. Using the standalone binary instead of the venv Python works equally well.

---

## Building a Standalone Binary

A self-contained executable can be built with PyInstaller using the included build scripts (`build.sh` on Linux/macOS, `build.ps1` on Windows). The resulting binary runs on systems without a Python installation.

### Prerequisites

**Linux:**

```bash
sudo apt install libudev-dev libusb-1.0-0-dev libgirepository1.0-dev gir1.2-appindicator3-0.1
```

**macOS:**

```bash
brew install libusb hidapi
```

**Windows:**

No additional system packages required.

### Build

`build.sh` / `build.ps1` create a virtual environment in `.venv`, install all dependencies (including PyInstaller), and build the executable. No system-wide pip install needed.

```bash
./build.sh            # build for the current platform
./build.sh --clean    # remove dist/, build/ and .venv, then rebuild
```

**Windows (PowerShell):**

```powershell
.\build.ps1              # build
.\build.ps1 -Clean       # remove dist/, build/ and .venv, then rebuild
```

### Output

| Platform    | Artifact                                                                         |
| ----------- | -------------------------------------------------------------------------------- |
| **Linux**   | `dist/blink1-listener` – single executable                                       |
| **macOS**   | `dist/Tally Arbiter Blink(1) Listener.app` – menu-bar app bundle (ad-hoc signed) |
| **Windows** | `dist\blink1-listener.exe` – single executable                                   |

The macOS app bundle is configured with `LSUIElement = 1` (no Dock icon) and `NSHighResolutionCapable = True`.

---

## Simulator Mode

If you do not have a blink(1) device – or want to test on a machine where no device is connected – pass `--skip-blink1`:

```bash
python3 blink1-listener.py --skip-blink1
```

The built-in `Blink1Simulator` prints color-coded output to the terminal instead of driving real hardware. The system tray icon still updates normally.

---

## Buying a blink(1)

- [Amazon (US)](https://www.amazon.com/ThingM-Blink-USB-RGB-BLINK1MK3/dp/B07Q8944QK/)
- [getDigital.de (EU)](https://www.getdigital.de/blink-1-mk2.html)
- [Seeed Studio (China)](https://www.seeedstudio.com/Blink-1-mk2-p-2367.html)

---

## Improvements and Suggestions

We welcome improvements and suggestions.
Feel free to join the discussion on [GitHub Discussions](https://github.com/josephdadams/TallyArbiter/discussions) or open a pull request.

To [report a bug](https://github.com/josephdadams/TallyArbiter/issues/new?assignees=JTF4&labels=bug&template=bug.yaml&title=%5BBug%5D%3A+) or submit a [feature request](https://github.com/josephdadams/TallyArbiter/issues/new?assignees=JTF4&labels=feature&template=feature.yaml&title=%5BFeature+Request%5D%3A+), please visit the [issues page](https://github.com/josephdadams/TallyArbiter/issues/new/choose).

If you'd like to see more of @josephdadams's projects, visit [techministry.blog](https://techministry.blog/).
