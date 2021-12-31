#!/usr/bin/env python3

## Tally Arbiter GPO Controller

from sys import exit
import sys
import os
import shutil
import time
from uuid import uuid4
from zeroconf import ServiceBrowser, Zeroconf
import socketio
import json
import atexit
import argparse

parser = argparse.ArgumentParser(description="Tally Arbiter Blink(1) Listener")
parser.add_argument(
    "--ip",
    help="Hostname or IP address of the server. Adding this flag, MDNS discovery will be disabled.",
)
parser.add_argument(
    "--port",
    help="Port of the server. Adding this flag, MDNS discovery will be disabled.",
)
parser.add_argument(
    "--config", default="config_gpo.json", help="Load with custom device id"
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
    "--skip-gpio",
    action="store_true",
    help="Skip the Rpi.GPIO requirment and simulate it (only for debugging)",
)
args = parser.parse_args()

configFileName = args.config

server_config = []
gpo_groups = []

server_use_mdns = True
server_uuid = False
server_version = "3.0.0"

device_states = []
bus_options = []

try:
    if configFileName == "config_gpo.json" and not os.path.isfile("config_gpo.json"):
        shutil.copyfile(configFileName + ".example", configFileName)
        print("config_gpo.json does not exist, creating a new one.")

    config_file = open(configFileName)
    config = config_file.read()
    config_file.close()
    if config != "":
        configJson = json.loads(config)
        if not "output_invert" in configJson:
            configJson["output_invert"] = False
            with open("config_gpo.json", "w") as outfile:
                json.dump(configJson, outfile, indent=4)
        if not "clientUUID" in configJson:
            configJson["clientUUID"] = str(uuid4())
            with open("config_gpo.json", "w") as outfile:
                json.dump(configJson, outfile, indent=4)
        if not "server_config" in configJson:
            configJson["server_config"] = {
                "ip": "127.0.0.1",
                "port": "4455",
                "use_mdns": True,
            }
            with open("config_gpo.json", "w") as outfile:
                json.dump(configJson, outfile, indent=4)
        server_config = configJson["server_config"]
        gpo_groups = configJson["gpo_groups"]
    else:
        print("Config data could not be loaded.")
        exit(0)
except IOError:
    print("Config file could not be located.")
    exit(0)

if args.ip:
    server_config["ip"] = args.ip
    server_config["use_mdns"] = False

if args.port:
    server_config["port"] = args.port
    server_config["use_mdns"] = False


class GPIOsimulator:
    BCM = "BCM"
    OUT = "OUT"

    def setmode(self, mode):
        print("Setting GPIO mode to {}".format(mode))

    def setwarnings(self, state):
        print("Setting GPIO warnings to {}".format(state))

    def setup(self, pin, mode):
        print("Setting GPIO pin {} to mode {}".format(pin, mode))

    def output(self, pin, state):
        print("Setting GPIO pin {} to state {}".format(pin, state))


try:
    import RPi.GPIO as GPIO  # pyright: reportMissingImports=false
except ImportError:
    GPIO = GPIOsimulator()
    if not args.skip_gpio:
        print("Rpi.GPIO is not found. Please install it and try again.")
        print(
            "If you want to try this program simulating GPIO add the flag --skip-gpio"
        )
        exit(1)


def getOutputValue(state):
    if configJson["output_invert"]:
        return not state
    else:
        return state

def setStates():
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)

    for gpo_group in gpo_groups:
        for gpo in gpo_group["gpos"]:
            GPIO.setup(gpo["pinNumber"], GPIO.OUT)
            GPIO.output(gpo["pinNumber"], getGPIOOutputValue(False))
            gpo["lastState"] = False

    atexit.register(GPO_off)


def GPO_off():
    print("Setting all GPOs to low before exiting.")
    for gpo_group in gpo_groups:
        for gpo in gpo_group["gpos"]:
            GPIO.setup(gpo["pinNumber"], GPIO.OUT)
            GPIO.output(gpo["pinNumber"], getOutputValue(False))
            gpo["lastState"] = False


# SocketIO Connections
sio = socketio.Client()

# ZeroConf instance
zeroconf = Zeroconf()


@sio.event
def connect():
    print("Connected to Tally Arbiter server")
    setStates()
    for gpo_group in gpo_groups:
        sio.emit(
            "listenerclient_connect",
            {  # start listening for the device
                "deviceId": gpo_group["deviceId"],
                "internalId": gpo_group["id"],
                "listenerType": "gpo_"
                + configJson["clientUUID"]
                + "_"
                + gpo_group["id"],
                "canBeReassigned": not args.disable_reassign,
                "canBeFlashed": not args.disable_flash,
                "supportsChat": False,
            },
        )


@sio.event
def connect_error(data):
    print("Unable to connect to Tally Arbiter server.")


@sio.event
def disconnect():
    print("Disconnected from Tally Arbiter server.")


@sio.event
def reconnect():
    print("Reconnected to Tally Arbiter server.")


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
    bus_options = data


@sio.on("flash")
def on_flash(gpoGroupId):
    print("Flash request received for gpo group {}".format(gpoGroupId))
    if args.disable_flash:
        return
    for gpo_group in gpo_groups:
        if str(gpo_group["id"]) == str(gpoGroupId):
            for gpo in gpo_group["gpos"]:
                GPIO.output(gpo["pinNumber"], getOutputValue(True))
                time.sleep(0.5)
                GPIO.output(gpo["pinNumber"], getOutputValue(False))
                time.sleep(0.5)
                GPIO.output(gpo["pinNumber"], getOutputValue(True))
                time.sleep(0.5)
                GPIO.output(gpo["pinNumber"], getOutputValue(False))
                time.sleep(0.5)
                GPIO.output(gpo["pinNumber"], gpo["lastState"])
    print()


@sio.on("reassign")
def on_reassign(oldDeviceId, newDeviceId, gpoGroupId):
    if args.disable_reassign:
        return
    print(
        "Reassigning GPO Group "
        + gpoGroupId
        + " from DeviceID: "
        + oldDeviceId
        + " to Device ID: "
        + newDeviceId
    )
    print()
    for gpo_group in gpo_groups:
        if gpo_group["id"] == gpoGroupId:
            gpo_group["deviceId"] = newDeviceId

    config_file = open(configFileName, "w")
    configJson = {}
    configJson["server_config"] = server_config
    configJson["gpo_groups"] = gpo_groups
    config_file.write(json.dumps(configJson, indent=4))
    config_file.close()


def getBusTypeById(busId):
    for bus in bus_options:
        if bus["id"] == busId:
            return bus["type"]


def processTallyData():
    if len(bus_options) > 0:
        powered_pins = []
        for device_state in device_states:
            if len(device_state["sources"]) > 0:
                for gpo_group in gpo_groups:
                    if device_state["deviceId"] == gpo_group["deviceId"]:
                        for gpo in gpo_group["gpos"]:
                            if gpo["busType"] == getBusTypeById(device_state["busId"]):
                                print("Turning on pin " + str(gpo["pinNumber"]))
                                GPIO.output(gpo["pinNumber"], getOutputValue(True))
                                gpo["lastState"] = True
                                powered_pins.append(gpo["pinNumber"])
        for gpo_group in gpo_groups:
            for gpo in gpo_group["gpos"]:
                if gpo["pinNumber"] not in powered_pins:
                    print("Turning off pin " + str(gpo["pinNumber"]))
                    GPIO.output(gpo["pinNumber"], getOutputValue(False))
                    gpo["lastState"] = False
        print()


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
                print("Tally Arbiter GPO Listener Running. Press CTRL-C to exit.")
                print(
                    "Attempting to connect to Tally Arbiter server: {}:{} (UUID {}, server version {})".format(
                        info.parsed_addresses()[0], str(info.port), server_uuid, server_version
                    )
                )
                sio.connect("http://" + info.parsed_addresses()[0] + ":" + str(info.port))
                sio.wait()
            except socketio.exceptions.ConnectionError:
                time.sleep(15)


try:
    if server_config["use_mdns"]:
        zeroconf = Zeroconf()
        listener = TallyArbiterServerListener()
        browser = ServiceBrowser(zeroconf, "_tally-arbiter._tcp.local.", listener)
        while True:
            time.sleep(0.1)
    else:
        while 1:
            try:
                print("Tally Arbiter GPO Listener Running. Press CTRL-C to exit.")
                print(
                    "Attempting to connect to Tally Arbiter server: {}:{}".format(
                        server_config["ip"], str(server_config["port"])
                    )
                )
                sio.connect(
                    "http://" + server_config["ip"] + ":" + str(server_config["port"])
                )
                sio.wait()
            except socketio.exceptions.ConnectionError:
                time.sleep(15)
except KeyboardInterrupt:
    print("Exiting Tally Arbiter GPO Listener.")
    exit(0)
except:
    print("Unexpected error:", sys.exc_info()[0])
    print("An error occurred internally.")
    exit(0)
