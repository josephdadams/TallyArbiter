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
#from datetime import datetime # Used for debugging device_states

# Copied from https://svn.blender.org/svnroot/bf-blender/trunk/blender/build_files/scons/tools/bcolors.py
class bcolors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

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


config_object = []

server_connected = False

device_states = []
bus_options = []

sio = socketio.Client()
zeroconf = Zeroconf()


def parseArgs():
    global args
    global configFileName
    parser = argparse.ArgumentParser(description="Tally Arbiter GPO Listener")
    parser.add_argument(
        "--ip",
        help="Hostname or IP address of the server. Adding this flag, MDNS discovery will be disabled.",
    )
    parser.add_argument(
        "--port",
        help="Port of the server. Adding this flag, MDNS discovery will be disabled.",
    )
    parser.add_argument(
        "--config",
        default="config_gpo.json",
        help="Load config from other path"
    )
    parser.add_argument(
        "--disable-reassign",
        action="store_true",
        help="Disable device reassignmend from UI",
    )
    parser.add_argument(
        "--disable-flash",
        action="store_true",
        help="Disable client listener flash"
    )
    parser.add_argument(
        "--skip-gpio",
        action="store_true",
        help="Skip the Rpi.GPIO requirement and simulate it (only for debugging)",
    )
    args = parser.parse_args()
    configFileName = args.config

def saveConfig():
    global config_object
    with open(configFileName, "w") as outfile:
        json.dump(config_object, outfile, indent=4)

def loadConfig():
    global config_object
    global GPIO

    try:
        if configFileName == "config_gpo.json" and not os.path.isfile("config_gpo.json"):
            shutil.copyfile(configFileName + ".example", configFileName)
            print("config_gpo.json does not exist, creating a new one.")

        config_file = open(configFileName)
        config = config_file.read()
        config_file.close()
        if config != "":
            config_object = json.loads(config)
            if not "output_invert" in config_object:
                config_object["output_invert"] = False
                saveConfig()
            if not "clientUUID" in config_object:
                config_object["clientUUID"] = str(uuid4())
                saveConfig()
            if not "server_config" in config_object:
                config_object["server_config"] = {
                    "ip": "127.0.0.1",
                    "port": "4455",
                    "use_mdns": True,
                }
                saveConfig()
        else:
            print(bcolors.FAIL + "Config data could not be loaded." + bcolors.ENDC)
            exit(0)
    except IOError:
        print(bcolors.FAIL + "Config file could not be located." + bcolors.ENDC)
        exit(0)

    if args.ip:
        config_object["server_config"]["ip"] = args.ip
        config_object["server_config"]["use_mdns"] = False
    if args.port:
        config_object["server_config"]["port"] = args.port
        config_object["server_config"]["use_mdns"] = False

    try:
        import RPi.GPIO as GPIO  # pyright: reportMissingImports=false
    except ImportError:
        GPIO = GPIOsimulator()
        if not args.skip_gpio:
            print(bcolors.FAIL + "Rpi.GPIO is not found. Please install it and try again." + bcolors.ENDC)
            print("If you want to try this program simulating GPIO add the flag --skip-gpio")
            exit(1)


def getOutputValue(state):
    if config_object["output_invert"]:
        return not state
    else:
        return state

def setStates():
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)

    for gpo_group in config_object["gpo_groups"]:
        for gpo in gpo_group["gpos"]:
            GPIO.setup(gpo["pinNumber"], GPIO.OUT)
            GPIO.output(gpo["pinNumber"], getOutputValue(False))
            gpo["lastState"] = False

def GPO_off():
    print("Setting all GPOs to low before exiting.")
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    for gpo_group in config_object["gpo_groups"]:
        for gpo in gpo_group["gpos"]:
            GPIO.setup(gpo["pinNumber"], GPIO.OUT)
            GPIO.output(gpo["pinNumber"], getOutputValue(False))
            gpo["lastState"] = False


@sio.event
def connect():
    global server_connected
    server_connected = True
    print(bcolors.OKGREEN + "Connected to Tally Arbiter server." + bcolors.ENDC)
    setStates()
    for gpo_group in config_object["gpo_groups"]:
        sio.emit(
            "listenerclient_connect",
            {  # start listening for the device
                "deviceId": gpo_group["deviceId"],
                "internalId": gpo_group["id"],
                "listenerType": "gpo_"
                + config_object["clientUUID"]
                + "_"
                + gpo_group["id"],
                "canBeReassigned": not args.disable_reassign,
                "canBeFlashed": not args.disable_flash,
                "supportsChat": False,
            },
        )

@sio.event
def connect_error(data):
    print(bcolors.FAIL + "Unable to connect to Tally Arbiter server." + bcolors.ENDC)

@sio.event
def disconnect():
    global server_connected
    server_connected = False
    print(bcolors.WARNING + "Disconnected from Tally Arbiter server." + bcolors.ENDC)

@sio.event
def reconnect():
    global server_connected
    server_connected = True
    print(bcolors.OKGREEN + "Reconnected to Tally Arbiter server." + bcolors.ENDC)

@sio.on("error")
def on_error(error):
    print(error)

@sio.on("device_states")
def on_device_states(data):
    global device_states
    device_states = data
    #print(data, datetime.now().time())
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
    for gpo_group in config_object["gpo_groups"]:
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
                GPIO.output(gpo["pinNumber"], getOutputValue(gpo["lastState"]))

@sio.on("reassign")
def on_reassign(oldDeviceId, newDeviceId, gpoGroupId):
    if args.disable_reassign:
        return
    print(
        bcolors.OKCYAN
        + "Reassigning GPO Group "
        + gpoGroupId
        + " from DeviceID: "
        + oldDeviceId
        + " to DeviceID: "
        + newDeviceId
        + bcolors.ENDC
    )
    for gpo_group in config_object["gpo_groups"]:
        if gpo_group["id"] == gpoGroupId:
            gpo_group["deviceId"] = newDeviceId

    saveConfig()
    sio.emit('listener_reassign_gpo', (gpoGroupId, oldDeviceId, newDeviceId));

def getBusTypeById(busId):
    for bus in bus_options:
        if bus["id"] == busId:
            return bus["type"]

def processTallyData():
    if len(bus_options) > 0:
        powered_pins = []
        for device_state in device_states:
            if len(device_state["sources"]) > 0:
                for gpo_group in config_object["gpo_groups"]:
                    if device_state["deviceId"] == gpo_group["deviceId"]:
                        for gpo in gpo_group["gpos"]:
                            if gpo["busType"] == getBusTypeById(device_state["busId"]):
                                #print("Turning on pin " + str(gpo["pinNumber"]))
                                GPIO.output(gpo["pinNumber"], getOutputValue(True))
                                gpo["lastState"] = True
                                powered_pins.append(gpo["pinNumber"])
        for device_state in device_states:
            for gpo_group in config_object["gpo_groups"]:
                if device_state["deviceId"] == gpo_group["deviceId"]:
                    for gpo in gpo_group["gpos"]:
                        if gpo["pinNumber"] not in powered_pins:
                            #print("Turning off pin " + str(gpo["pinNumber"]))
                            GPIO.output(gpo["pinNumber"], getOutputValue(False))
                            gpo["lastState"] = False
        #print(powered_pins, datetime.now().time())

class TallyArbiterServerListener:
    def remove_service(self, zeroconf, type, name):
        pass

    def update_service(self, zeroconf, type, name):
        pass

    def add_service(self, zeroconf, type, name):
        if server_connected:
            return
        info = zeroconf.get_service_info(type, name)
        server_uuid = info.properties.get(b"uuid").decode("utf-8")
        server_version = info.properties.get(b"version").decode("utf-8")
        if not server_version.startswith("3."):
            print(
                bcolors.FAIL
                + "Found Tally Arbiter Server version "
                + server_version
                + " but only version " + bcolors.BOLD + "3.x.x" + bcolors.ENDC + " is supported."
                + bcolors.ENDC
            )
            print(
                "Please update Tally Arbiter to latest version or use an older version of this client."
            )
            return
        print("Found Tally Arbiter Server (version " + bcolors.OKCYAN + server_version + bcolors.ENDC + " server UUID " + bcolors.OKCYAN + server_uuid + bcolors.ENDC + ")")
        server_connect("http://" + info.parsed_addresses()[0] + ":" + str(info.port))

def server_connect(url):
    try:
        print("Attempting to connect to Tally Arbiter server: " + bcolors.OKCYAN + url + bcolors.ENDC)
        sio.connect(url)
        sio.wait()
    except socketio.exceptions.ConnectionError:
        print(bcolors.FAIL + "Connection error: retrying in 15 seconds." + bcolors.ENDC)
        time.sleep(15)
        server_connect(url)

def main():
    global server_connected
    print(bcolors.HEADER + "Tally Arbiter GPO Listener Running. Press CTRL-C to exit." + bcolors.ENDC)
    parseArgs()
    loadConfig()
    atexit.register(GPO_off)
    try:
        if config_object["server_config"]["use_mdns"]:
            zeroconf = Zeroconf()
            listener = TallyArbiterServerListener()
            browser = ServiceBrowser(zeroconf, "_tally-arbiter._tcp.local.", listener)
            while True:
                time.sleep(0.1)
        else:
            server_connect("http://" + str(config_object["server_config"]["ip"]) + ":" + str(config_object["server_config"]["port"]))
    except KeyboardInterrupt:
        print(bcolors.OKBLUE + "Exiting Tally Arbiter GPO Listener." + bcolors.ENDC)
        exit(0)
    except:
        print("Unexpected error:", sys.exc_info()[0])
        print(bcolors.FAIL + "An error occurred internally. Please open an issue report on TallyArbiter Github." + bcolors.ENDC)
        exit(0)

if __name__ == "__main__":
    main()
