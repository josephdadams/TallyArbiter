## Tally Arbiter Pimoroni Blinkt Listener

# File name: pimoroni-blinkt-listener.py
# Author: Joseph Adams
# Email: josephdadams@gmail.com
# Date created: 02/26/2021
# Notes: This file is a part of the Tally Arbiter project. For more information, visit tallyarbiter.com

from signal import signal, SIGINT
from sys import exit
import sys
import os
import time
from uuid import uuid4
from zeroconf import ServiceBrowser, Zeroconf
import socketio
import argparse
import configparser

config = configparser.ConfigParser()
if not os.path.isfile("config.ini"):
    deviceId = ""
    if os.path.isfile("deviceid.txt"):
        print(
            "pimoroni-blinkt-listener has been updated since the last time you used it."
        )
        print("Please read the new documentation to use this program property.")
        print("Reading device ID from deviceid.txt")
        deviceId = open("deviceid.txt", "r").read()
    config["DEFAULT"] = {
        "deviceId": deviceId,
        "host": "localhost",
        "port": 4455,
        "useMDNS": True,
        "clientUUID": uuid4(),
    }
    with open("config.ini", "w") as configfile:
        config.write(configfile)
else:
    config.read("config.ini")

if os.path.isfile("deviceid.txt"):
    os.remove("deviceid.txt")

parser = argparse.ArgumentParser(description="Tally Arbiter Pimoroni Blinkt Listener")
parser.add_argument(
    "--host",
    default=config["DEFAULT"]["host"],
    help="Hostname or IP address of the server. Adding this flag, MDNS discovery will be disabled.",
)
parser.add_argument(
    "--port",
    default=config["DEFAULT"]["port"],
    help="Port of the server. Adding this flag, MDNS discovery will be disabled.",
)
parser.add_argument("--device-id", default=None, help="Load with custom device id")
parser.add_argument(
    "--debug", action="store_true", help="Show advanced logs usefull for debugging"
)
parser.add_argument(
    "--disable-reassign",
    action="store_true",
    help="Disable device reassignmend from UI",
)
parser.add_argument(
    "--disable-flash", action="store_true", help="Disable client listener flash"
)
parser.add_argument(
    "--skip-blinkt",
    action="store_true",
    help="Skip the Blinkt! requirment and simulate it (only for debugging)",
)
args = parser.parse_args()


def debug(message=None):
    if args.debug:
        if message:
            print(message)
        else:
            print()


debug(args)


class Blinktsimulator:
    def __init__(self):
        self.r = 0
        self.g = 0
        self.b = 0

    def set_all(self, r, g, b):
        self.r = r
        self.g = g
        self.b = b

    def show(self):
        print(
            "\033[38;2;{};{};{}m{} \033[38;2;255;255;255m".format(
                self.r, self.g, self.b, " Blinkt! color"
            )
        )

    def set_clear_on_exit(self, set_clear=True):
        pass

    def set_color(self, r, g, b):
        self.set_all(r, g, b)
        self.show()


try:
    import blinkt  # pyright: reportMissingImports=false
except ImportError:
    if not args.skip_blinkt:
        print("Blinkt is not installed. Please install it and try again.")
        print(
            "If you want to try this program simulating Blinkt! add the flag --skip-blinkt"
        )
        exit(1)
    blinkt = Blinktsimulator()

blinkt.set_clear_on_exit(True)

device_states = []
bus_options = []
debounce = False  # used to keep calls from happing concurrently

server_uuid = False

if config["DEFAULT"]["deviceId"]:
    print("Last Used Device Id: " + config["DEFAULT"]["deviceId"])

if not args.device_id:
    if not config["DEFAULT"]["deviceId"]:
        config["DEFAULT"]["deviceId"] = "null"
    args.device_id = config["DEFAULT"]["deviceId"]

# SocketIO Connections
sio = socketio.Client()

# ZeroConf instance
zeroconf = Zeroconf()


@sio.event
def connect():
    print("Connected to Tally Arbiter server:", args.host, args.port)
    sio.emit(
        "listenerclient_connect",
        {  # start listening for the device
            "deviceId": config["DEFAULT"]["deviceId"],
            "listenerType": "pimoroni_blinkt_" + config["DEFAULT"]["clientUUID"],
            "canBeReassigned": not args.disable_reassign,
            "canBeFlashed": not args.disable_flash,
            "supportsChat": False,
        },
    )
    repeatNumber = 2
    while repeatNumber:
        repeatNumber = repeatNumber - 1
        doBlink(0, 255, 0)
        time.sleep(0.3)
        doBlink(0, 255, 0)
        time.sleep(0.3)


@sio.event
def connect_error(data):
    print("Unable to connect to Tally Arbiter server:", args.host, args.port)
    doBlink(150, 150, 150)
    time.sleep(0.3)
    doBlink(0, 0, 0)
    time.sleep(0.3)


@sio.event
def disconnect():
    print("Disconnected from Tally Arbiter server:", args.host, args.port)
    doBlink(255, 255, 255)
    time.sleep(0.3)
    doBlink(0, 0, 0)
    time.sleep(0.3)


@sio.event
def reconnect():
    print("Reconnected to Tally Arbiter server:", args.host, args.port)
    repeatNumber = 2
    while repeatNumber:
        repeatNumber = repeatNumber - 1
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
    if args.disable_flash:
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
    if args.disable_reassign:
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
    with open("config.ini", "w") as configfile:
        config.write(configfile)


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
            busses_list.sort(key=lambda x: x["priority"])
        except:
            return
        # TODO: make this work with more than one bus
        """
		for current_bus in busses_list:
			current_color = hex_to_rgb(current_bus['color'])
			debug('Bus: ' + current_bus['type'] + ' - ' + ";".join(str(n) for n in current_color))
			doBlink(*current_color)
		"""
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
    global debounce, args
    if debounce != True:
        debounce = True
        blinkt.set_all(r, g, b)
        blinkt.show()
        debounce = False


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
        while 1:
            try:
                print(
                    "Tally Arbiter Pimoroni Blinkt Listener Running. Press CTRL-C to exit."
                )
                print(
                    "Attempting to connect to Tally Arbiter server: {}:{} (UUID {}, server version {})".format(
                        info.server, str(info.port), server_uuid, server_version
                    )
                )
                sio.connect("http://" + info.server + ":" + str(info.port))
                sio.wait()
            except socketio.exceptions.ConnectionError:
                time.sleep(15)


try:
    if "useMDNS" in config["DEFAULT"] and config["DEFAULT"]["useMDNS"]:
        zeroconf = Zeroconf()
        listener = TallyArbiterServerListener()
        browser = ServiceBrowser(zeroconf, "_tally-arbiter._tcp.local.", listener)
        while True:
            time.sleep(0.1)
    else:
        while 1:
            try:
                print(
                    "Tally Arbiter Pimoroni Blinkt Listener Running. Press CTRL-C to exit."
                )
                print(
                    "Attempting to connect to Tally Arbiter server: {}:{}".format(
                        config["DEFAULT"]["host"], str(config["DEFAULT"]["port"])
                    )
                )
                sio.connect(
                    "http://"
                    + config["DEFAULT"]["host"]
                    + ":"
                    + str(config["DEFAULT"]["port"])
                )
                sio.wait()
            except socketio.exceptions.ConnectionError:
                doBlink(0, 0, 0)
                time.sleep(15)
except KeyboardInterrupt:
    print("Exiting Tally Arbiter Pimoroni Blinkt Listener.")
    doBlink(0, 0, 0)
    exit(0)
except:
    print("Unexpected error:", sys.exc_info()[0])
    print("An error occurred internally.")
    doBlink(0, 0, 0)
    exit(0)
