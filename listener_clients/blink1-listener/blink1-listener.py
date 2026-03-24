# Tally Arbiter Blink(1) Listener
# File name: blink1-listener.py
# Author: Joseph Adams
# Email: josephdadams@gmail.com
# Notes: This file is a part of the Tally Arbiter project. For more information, visit tallyarbiter.com

import sys
import os
import time
import signal as _signal
import threading
import tempfile
import logging
from uuid import uuid4
from zeroconf import ServiceBrowser, Zeroconf
import socketio
import argparse
import configparser

# When running as a frozen .app on macOS (no console), redirect all output to
# a log file so crashes leave a trace the user can find and report.
def _setup_logging():
    if not getattr(sys, "frozen", False):
        return  # plain-script: let output go to the terminal as usual
    if sys.platform == "darwin":
        log_dir = os.path.expanduser("~/Library/Logs/blink1-listener")
    else:
        log_dir = os.path.expanduser("~/.local/share/blink1-listener/logs")
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, "blink1-listener.log")
    logging.basicConfig(
        filename=log_path,
        level=logging.DEBUG,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    # Redirect stdout/stderr into the log so print() and tracebacks appear there.
    sys.stdout = open(log_path, "a", buffering=1)
    sys.stderr = sys.stdout
    print(f"=== blink1-listener started (log: {log_path}) ===")

_setup_logging()

# PIL is needed for tray icon image creation on all platforms.
try:
    from PIL import Image, ImageDraw
    _PIL_AVAILABLE = True
except ImportError:
    _PIL_AVAILABLE = False

# Linux: drive AppIndicator3 / AyatanaAppIndicator3 directly.
# pystray wraps the same library but has a long-standing bug where the icon
# never shows up (https://github.com/moses-palmer/pystray/issues/175).
_USE_APPINDICATOR = False
if _PIL_AVAILABLE and sys.platform not in ("darwin", "win32"):
    try:
        import gi
        gi.require_version("Gtk", "3.0")
        try:
            gi.require_version("AyatanaAppIndicator3", "0.1")
            from gi.repository import AyatanaAppIndicator3 as AppIndicator3
        except (ValueError, ImportError):
            gi.require_version("AppIndicator3", "0.1")
            from gi.repository import AppIndicator3
        from gi.repository import GLib, Gtk
        _USE_APPINDICATOR = True
    except Exception:
        pass

# macOS / Windows: fall back to pystray (works fine there).
_USE_PYSTRAY = False
if _PIL_AVAILABLE and not _USE_APPINDICATOR:
    try:
        import pystray
        _USE_PYSTRAY = True
    except ImportError:
        pass

TRAY_AVAILABLE = _USE_APPINDICATOR or _USE_PYSTRAY

def _get_config_dir():
    """Return a writable directory for config files.

    When running as a frozen PyInstaller bundle the working directory is
    unreliable (macOS sets it to / for .app launches), so we fall back to a
    well-known per-user location.  Plain-script invocations keep the existing
    behaviour of using the current working directory.
    """
    if getattr(sys, "frozen", False):
        if sys.platform == "darwin":
            base = os.path.expanduser("~/Library/Application Support/blink1-listener")
        else:
            base = os.path.expanduser("~/.config/blink1-listener")
        os.makedirs(base, exist_ok=True)
        return base
    return "."

_CONFIG_DIR = _get_config_dir()
_CONFIG_FILE = os.path.join(_CONFIG_DIR, "config.ini")
_DEVICEID_FILE = os.path.join(_CONFIG_DIR, "deviceid.txt")

config = configparser.ConfigParser()
if not os.path.isfile(_CONFIG_FILE):
    deviceId = ""
    if os.path.isfile(_DEVICEID_FILE):
        print("blink1-listener has been updated since the last time you used it.")
        print("Please read the new documentation to use this program properly.")
        print("Reading device ID from deviceid.txt")
        with open(_DEVICEID_FILE, "r") as f:
            deviceId = f.read()
    config["DEFAULT"] = {
        "deviceId": deviceId,
        "host": "localhost",
        "port": 4455,
        "useMDNS": True,
        "clientUUID": uuid4(),
    }
    with open(_CONFIG_FILE, "w") as configfile:
        config.write(configfile)
else:
    config.read(_CONFIG_FILE)

if os.path.isfile(_DEVICEID_FILE):
    os.remove(_DEVICEID_FILE)

parser = argparse.ArgumentParser(description="Tally Arbiter Blink(1) Listener")
parser.add_argument(
    "--host",
    default=None,
    help="Hostname or IP address of the server. Providing this flag disables MDNS discovery.",
)
parser.add_argument(
    "--port",
    default=None,
    help="Port of the server. Providing this flag disables MDNS discovery.",
)
parser.add_argument("--device-id", default=None, help="Load with custom device id")
parser.add_argument(
    "--debug", action="store_true", help="Show advanced logs useful for debugging"
)
parser.add_argument(
    "--disable-reassign",
    action="store_true",
    help="Disable device reassignment from UI",
)
parser.add_argument(
    "--disable-flash", action="store_true", help="Disable client listener flash"
)
parser.add_argument(
    "--disable-status-blink", action="store_true", help="Disable all status light blinks"
)
parser.add_argument(
    "--skip-blink1",
    action="store_true",
    help="Skip the Blink(1) requirement and simulate it (only for debugging)",
)
parser.add_argument(
    "--no-tray",
    action="store_true",
    help="Disable the system tray and run in terminal mode only",
)
args = parser.parse_args()

# If --host or --port is explicitly provided, disable MDNS discovery
if args.host is not None or args.port is not None:
    config["DEFAULT"]["useMDNS"] = "false"

# Fall back to config values when not provided on the command line
if args.host is None:
    args.host = config["DEFAULT"]["host"]
if args.port is None:
    args.port = config["DEFAULT"]["port"]


def debug(message=None):
    if args.debug:
        if message:
            print(message)
        else:
            print()


debug(args)


class Blink1Simulator:
    def __init__(self):
        self.r = 0
        self.g = 0
        self.b = 0

    def set_rgb(self, r, g, b):
        self.r = r
        self.g = g
        self.b = b
        print(
            "\033[38;2;{};{};{}m{} \033[38;2;255;255;255m".format(
                r, g, b, " blink1 color"
            )
        )

    def fade_to_rgb(self, duration, r, g, b):
        self.set_rgb(r, g, b)

    def get_rgb(self):
        return self.r, self.g, self.b


try:
    from blink1.blink1 import Blink1  # type: ignore # pyright: ignore[reportMissingImports]

    try:
        b1 = Blink1()
    except Exception:
        print("No blink(1) devices found.")
        b1 = Blink1Simulator()
except ImportError:
    if not args.skip_blink1:
        print("blink1 is not installed. Please install it and try again.")
        print(
            "If you want to try this program simulating blink1, add the flag --skip-blink1"
        )
        sys.exit(1)
    b1 = Blink1Simulator()

device_states = []
bus_options = []
debounce = False  # used to keep calls from happening concurrently

server_uuid = False
tray_icon = None      # pystray Icon  (macOS / Windows)
_indicator = None     # AppIndicator3 (Linux)
_icon_tmp_path = None # temp PNG file written for AppIndicator
_stop_event = threading.Event()

if config["DEFAULT"]["deviceId"]:
    print("Last Used Device Id: " + config["DEFAULT"]["deviceId"])

if not args.device_id:
    if not config["DEFAULT"]["deviceId"]:
        config["DEFAULT"]["deviceId"] = "null"
    args.device_id = config["DEFAULT"]["deviceId"]

# SocketIO Connection
sio = socketio.Client()


# --- System tray helpers ---

def create_tray_image(r, g, b):
    """Return a PIL Image for the tray icon (solid background, colored circle)."""
    size = 64
    # RGB (no alpha) with a dark background so the icon is always opaque –
    # RGBA with a transparent bg renders invisible on dark panels.
    img = Image.new("RGB", (size, size), (30, 30, 30))
    draw = ImageDraw.Draw(img)
    color = (r, g, b) if (r or g or b) else (180, 180, 180)
    draw.ellipse([4, 4, size - 4, size - 4], fill=color)
    return img


def update_tray_icon(r, g, b):
    """Update the system tray icon to reflect the current tally color."""
    global tray_icon, _indicator, _icon_tmp_path
    try:
        if _USE_APPINDICATOR and _indicator is not None:
            # Write to a NEW temp file each time: AppIndicator caches by file
            # path and won't re-read the file if the path hasn't changed.
            fd, new_path = tempfile.mkstemp(suffix=".png", prefix="blink1-tray-")
            os.close(fd)
            create_tray_image(r, g, b).save(new_path)
            old_path, _icon_tmp_path = _icon_tmp_path, new_path
            # Call set_icon_full directly – GLib/AppIndicator property setters
            # are thread-safe. GLib.idle_add callbacks silently fail in frozen
            # PyInstaller binaries when GI_TYPELIB_PATH is overridden.
            _indicator.set_icon_full(new_path, "")
            if old_path:
                try:
                    os.unlink(old_path)
                except Exception:
                    pass
        elif _USE_PYSTRAY and tray_icon is not None:
            tray_icon.icon = create_tray_image(r, g, b)
    except Exception:
        pass


# --- SocketIO event handlers ---

@sio.event
def connect():
    print("Connected to Tally Arbiter server:", args.host, args.port)
    sio.emit(
        "listenerclient_connect",
        {
            "deviceId": config["DEFAULT"]["deviceId"],
            "listenerType": "blink1_" + config["DEFAULT"]["clientUUID"],
            "canBeReassigned": not args.disable_reassign,
            "canBeFlashed": not args.disable_flash,
            "supportsChat": False,
        },
    )
    if args.disable_status_blink:
        return
    for _ in range(2):
        doBlink(0, 255, 0)
        time.sleep(0.3)
        doBlink(0, 255, 0)
        time.sleep(0.3)


@sio.event
def connect_error(data):
    if _stop_event.is_set():
        return
    print("Unable to connect to Tally Arbiter server:", args.host, args.port)
    if args.disable_status_blink:
        return
    doBlink(150, 150, 150)
    time.sleep(0.3)
    doBlink(0, 0, 0)
    time.sleep(0.3)


@sio.event
def disconnect():
    if _stop_event.is_set():
        return
    print("Disconnected from Tally Arbiter server:", args.host, args.port)
    if args.disable_status_blink:
        return
    doBlink(255, 255, 255)
    time.sleep(0.3)
    doBlink(0, 0, 0)
    time.sleep(0.3)


@sio.event
def reconnect():
    if _stop_event.is_set():
        return
    print("Reconnected to Tally Arbiter server:", args.host, args.port)
    if args.disable_status_blink:
        return
    for _ in range(2):
        doBlink(0, 255, 0)
        time.sleep(0.3)
        doBlink(0, 0, 0)
        time.sleep(0.3)


@sio.on("error")
def on_error(error):
    print(error)


@sio.on("device_states")
def on_device_states(data):
    global device_states
    device_states = data
    processTallyData()


@sio.on("bus_options")
def on_bus_options(data):
    global bus_options
    debug(data)
    bus_options = data


@sio.on("flash")
def on_flash(internalId):
    if _stop_event.is_set() or args.disable_flash:
        return
    doBlink(255, 255, 255)
    time.sleep(0.5)
    doBlink(0, 0, 0)
    time.sleep(0.5)
    doBlink(255, 255, 255)
    time.sleep(0.5)
    doBlink(0, 0, 0)
    time.sleep(0.5)
    doBlink(255, 255, 255)
    time.sleep(0.5)


@sio.on("reassign")
def on_reassign(oldDeviceId, newDeviceId, internalId):
    if _stop_event.is_set() or args.disable_reassign:
        return
    print("Reassigning from DeviceID: " + oldDeviceId + " to Device ID: " + newDeviceId)
    doBlink(0, 0, 0)
    time.sleep(0.1)
    doBlink(0, 0, 255)
    time.sleep(0.1)
    doBlink(0, 0, 0)
    time.sleep(0.1)
    doBlink(0, 0, 255)
    time.sleep(0.1)
    doBlink(0, 0, 0)
    sio.emit("listener_reassign", data=(oldDeviceId, newDeviceId))
    config["DEFAULT"]["deviceId"] = newDeviceId
    with open(_CONFIG_FILE, "w") as configfile:
        config.write(configfile)


# --- Tally logic ---

def getBusById(busId):
    for bus in bus_options:
        if bus["id"] == busId:
            return bus


def hex_to_rgb(hex_string):
    hex_string = hex_string.lstrip("#")
    return tuple(int(hex_string[i : i + 2], 16) for i in (0, 2, 4))


def processTallyData():
    busses_list = []
    for device_state in device_states:
        current_bus = getBusById(device_state["busId"])
        if len(device_state["sources"]) > 0:
            busses_list.append(current_bus)

    if len(busses_list) == 0:
        debug("Bus: nothing")
        doBlink(0, 0, 0)
    else:
        try:
            busses_list.sort(key=lambda x: x["priority"], reverse=True)
        except (KeyError, TypeError):
            return
        current_color = hex_to_rgb(busses_list[0]["color"])
        debug(
            "Bus: "
            + busses_list[0]["type"]
            + " - "
            + ";".join(str(n) for n in current_color)
        )
        doBlink(*current_color)
    debug()


def doBlink(r, g, b):
    global debounce
    if not debounce:
        debounce = True
        b1.fade_to_rgb(100, r, g, b)
        update_tray_icon(r, g, b)
        debounce = False


# --- MDNS listener ---

class TallyArbiterServerListener:
    def remove_service(self, zeroconf, type, name):
        pass

    def update_service(self, zeroconf, type, name):
        pass

    def add_service(self, zeroconf, type, name):
        global server_uuid
        if server_uuid:
            return
        info = zeroconf.get_service_info(type, name)
        server_uuid = info.properties.get(b"uuid").decode("utf-8")
        server_version = info.properties.get(b"version").decode("utf-8")
        if not server_version.startswith("3."):
            print(
                "Found Tally Arbiter Server version "
                + server_version
                + " but only version 3.x.x is supported."
            )
            print(
                "Please update Tally Arbiter to latest version or use an older version of this client."
            )
            return
        while not _stop_event.is_set():
            try:
                print("Tally Arbiter Blink(1) Listener Running. Press CTRL-C to exit.")
                print(
                    "Attempting to connect to Tally Arbiter server: {}:{} (UUID {}, server version {})".format(
                        info.server, str(info.port), server_uuid, server_version
                    )
                )
                # Strip trailing dot from FQDN: Windows getaddrinfo fails on "host." form
                connect_host = info.server.rstrip(".")
                sio.connect("http://" + connect_host + ":" + str(info.port))
                sio.wait()
            except socketio.exceptions.ConnectionError:
                _stop_event.wait(15)


# --- Main listener loop (runs in background thread) ---

def run_listener():
    try:
        use_mdns = str(config["DEFAULT"].get("useMDNS", "false")).lower() == "true"
        if use_mdns:
            zc = Zeroconf()
            listener = TallyArbiterServerListener()
            browser = ServiceBrowser(zc, "_tally-arbiter._tcp.local.", listener)
            _stop_event.wait()
            zc.close()
        else:
            while not _stop_event.is_set():
                try:
                    print("Tally Arbiter Blink(1) Listener Running. Press CTRL-C to exit.")
                    print(
                        "Attempting to connect to Tally Arbiter server: {}:{}".format(
                            args.host, str(args.port)
                        )
                    )
                    sio.connect("http://" + args.host + ":" + str(args.port))
                    sio.wait()
                except socketio.exceptions.ConnectionError:
                    doBlink(0, 0, 0)
                    _stop_event.wait(15)
    except Exception as e:
        print("Unexpected error:", e)
        print("An error occurred internally.")
        doBlink(0, 0, 0)


# --- Shutdown ---

def quit_app(*_args):
    """Gracefully shut down the listener and tray, then exit the process."""
    global tray_icon, _icon_tmp_path
    if _stop_event.is_set():
        return
    _stop_event.set()
    try:
        if sio.connected:
            sio.disconnect()
    except Exception:
        pass
    tray_icon = None
    try:
        b1.fade_to_rgb(100, 0, 0, 0)
    except Exception:
        pass
    if _icon_tmp_path:
        try:
            os.unlink(_icon_tmp_path)
        except Exception:
            pass
    print("Exiting Tally Arbiter Blink(1) Listener.")
    os._exit(0)  # force-terminate; avoids hanging on socketio non-daemon threads


# --- Entry point ---

def main():
    global tray_icon

    listener_thread = threading.Thread(target=run_listener, daemon=True)
    listener_thread.start()

    # Both SIGTERM (systemd/launchd) and SIGINT (Ctrl-C) trigger a clean shutdown.
    _signal.signal(_signal.SIGTERM, lambda s, f: quit_app())
    _signal.signal(_signal.SIGINT, lambda s, f: quit_app())

    use_tray = TRAY_AVAILABLE and not args.no_tray
    if use_tray:
        if _USE_APPINDICATOR:
            # Linux: manage the AppIndicator + GLib event loop directly.
            def run_tray():
                global _indicator, _icon_tmp_path
                try:
                    Gtk.init([])

                    fd, _icon_tmp_path = tempfile.mkstemp(
                        suffix=".png", prefix="blink1-tray-"
                    )
                    os.close(fd)
                    create_tray_image(0, 0, 0).save(_icon_tmp_path)

                    _indicator = AppIndicator3.Indicator.new(
                        "blink1-listener",
                        _icon_tmp_path,
                        AppIndicator3.IndicatorCategory.APPLICATION_STATUS,
                    )
                    _indicator.set_status(AppIndicator3.IndicatorStatus.ACTIVE)

                    menu = Gtk.Menu()
                    title = Gtk.MenuItem(label="Tally Arbiter Blink(1) Listener")
                    title.set_sensitive(False)
                    menu.append(title)
                    menu.append(Gtk.SeparatorMenuItem())
                    quit_item = Gtk.MenuItem(label="Quit")
                    quit_item.connect("activate", lambda *_: quit_app())
                    menu.append(quit_item)
                    menu.show_all()
                    _indicator.set_menu(menu)

                    GLib.MainLoop().run()
                except Exception as e:
                    print(f"System tray unavailable ({e}), running in terminal mode.")
                    print(
                        "On Linux, install the required packages:\n"
                        "  sudo apt install python3-gi gir1.2-ayatana-appindicator3-0.1\n"
                        "  # or on older systems: gir1.2-appindicator3-0.1\n"
                        "  # or pass --no-tray to disable the system tray"
                    )

            threading.Thread(target=run_tray, daemon=True).start()

        elif _USE_PYSTRAY:
            # macOS / Windows: use pystray.
            menu = pystray.Menu(
                pystray.MenuItem(
                    "Tally Arbiter Blink(1) Listener", None, enabled=False
                ),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("Quit", quit_app),
            )
            tray_icon = pystray.Icon(
                "blink1-listener",
                icon=create_tray_image(0, 0, 0),
                title="Tally Arbiter Blink(1) Listener",
                menu=menu,
            )

            if sys.platform == "darwin":
                # Cocoa requires the event loop on the main thread.
                try:
                    tray_icon.run(setup=lambda icon: setattr(icon, "visible", True))
                except Exception as e:
                    print(f"System tray unavailable ({e}), running in terminal mode.")
                return

            def run_tray_pystray():
                try:
                    tray_icon.run(setup=lambda icon: setattr(icon, "visible", True))
                except Exception as e:
                    print(f"System tray unavailable ({e}), running in terminal mode.")

            threading.Thread(target=run_tray_pystray, daemon=True).start()

    # Block the main thread until a signal fires quit_app() → os._exit().
    _stop_event.wait()


if __name__ == "__main__":
    main()
