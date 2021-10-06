## Tally Arbiter Blink(1) Listener

# File name: blink1-listener.py
# Author: Joseph Adams
# Email: josephdadams@gmail.com
# Notes: This file is a part of the Tally Arbiter project. For more information, visit tallyarbiter.com

from signal import signal, SIGINT
from sys import exit
import sys
import os
import time
from uuid import uuid4
import socketio
import argparse
import configparser

config = configparser.ConfigParser()
if not os.path.isfile('config.ini'):
	deviceId = ''
	if os.path.isfile('deviceid.txt'):
		print("blink1-listener has been updated since the last time you used it.")
		print("Please read the new documentation to use this program property.")
		print("Reading device ID from deviceid.txt")
		deviceId = open('deviceid.txt', 'r').read()
	config['DEFAULT'] = {
		'deviceId': deviceId,
		'host': 'localhost',
		'port': 4455,
		'clientUUID': uuid4()
	}
	with open('config.ini', 'w') as configfile:
		config.write(configfile)
else:
	config.read('config.ini')

if os.path.isfile('deviceid.txt'):
	os.remove('deviceid.txt')

parser = argparse.ArgumentParser(description='Tally Arbiter Blink(1) Listener')
parser.add_argument('--host', default=config['DEFAULT']['host'], help='Hostname or IP address of the server')
parser.add_argument('--port', default=config['DEFAULT']['port'], help='Port of the server')
parser.add_argument('--device-id', default=None, help='Load with custom device id')
parser.add_argument('--debug', action='store_true', help='Show advanced logs usefull for debugging')
parser.add_argument('--disable-reassign', action='store_true', help='Disable device reassignmend from UI')
parser.add_argument('--disable-flash', action='store_true', help='Disable client listener flash')
parser.add_argument('--skip-blink1', action='store_true', help='Skip the Blink(1) requirment and simulate it (only for debugging)')
args = parser.parse_args()

def debug(message = None):
	if args.debug:
		if message:
			print(message)
		else:
			print()

debug(args)

try:
    from blink1.blink1 import Blink1 # pyright: reportMissingImports=false
    try:
        b1 = Blink1()
    except:
        print('No blink(1) devices found.')
except ImportError:
    b1 = None
    if not args.skip_blink1:
        print("blink1 is not installed. Please install it and try again.")
        print("If you want to try this program simulating blink1 add the flag --skip-blink1")
        exit(1)

device_states = []
bus_options = []
debounce = False #used to keep calls from happing concurrently

if config['DEFAULT']['deviceId']:
	print('Last Used Device Id: ' + config['DEFAULT']['deviceId'])

if not args.device_id:
	if not config['DEFAULT']['deviceId']:
		config['DEFAULT']['deviceId'] = 'null'
	args.device_id = config['DEFAULT']['deviceId']

#SocketIO Connections
sio = socketio.Client()

@sio.event
def connect():
	print('Connected to Tally Arbiter server:', args.host, args.port)
	sio.emit('listenerclient_connect', {  # start listening for the device
		'deviceId': config['DEFAULT']['deviceId'],
		'listenerType': 'blink1_' + config['DEFAULT']['clientUUID'],
		'canBeReassigned': not args.disable_reassign,
		'canBeFlashed': not args.disable_flash,
		'supportsChat': False
	})
	repeatNumber = 2
	while(repeatNumber):
		repeatNumber = repeatNumber - 1
		doBlink(0, 255, 0)
		time.sleep(.3)
		doBlink(0, 255, 0)
		time.sleep(.3)

@sio.event
def connect_error(data):
	print('Unable to connect to Tally Arbiter server:', args.host, args.port)
	doBlink(150, 150, 150)
	time.sleep(.3)
	doBlink(0, 0, 0)
	time.sleep(.3)

@sio.event
def disconnect():
	print('Disconnected from Tally Arbiter server:', args.host, args.port)
	doBlink(255, 255, 255)
	time.sleep(.3)
	doBlink(0, 0, 0)
	time.sleep(.3)

@sio.event
def reconnect():
	print('Reconnected to Tally Arbiter server:', args.host, args.port)
	repeatNumber = 2
	while(repeatNumber):
		repeatNumber = repeatNumber - 1
		doBlink(0, 255, 0)
		time.sleep(.3)
		doBlink(0, 0, 0)
		time.sleep(.3)

@sio.on('error')
def on_error(error):
	print(error)

@sio.on('device_states')
def on_device_states(data):
	global device_states
	device_states = data
	processTallyData()

@sio.on('bus_options')
def on_bus_options(data):
	global bus_options
	debug(data)
	bus_options = data

@sio.on('flash')
def on_flash():
	if args.disable_flash:
		return
	doBlink(255, 255, 255)
	time.sleep(.5)
	doBlink(0, 0, 0)
	time.sleep(.5)
	doBlink(255, 255, 255)
	time.sleep(.5)
	doBlink(0, 0, 0)
	time.sleep(.5)
	doBlink(255, 255, 255)
	time.sleep(.5)

@sio.on('reassign')
def on_reassign(oldDeviceId, newDeviceId):
	if args.disable_reassign:
		return
	print('Reassigning from DeviceID: ' + oldDeviceId + ' to Device ID: ' + newDeviceId)
	doBlink(0, 0, 0)
	time.sleep(.1)
	doBlink(0, 0, 255)
	time.sleep(.1)
	doBlink(0, 0, 0)
	time.sleep(.1)
	doBlink(0, 0, 255)
	time.sleep(.1)
	doBlink(0, 0, 0)
	sio.emit('listener_reassign', data=(oldDeviceId, newDeviceId))
	config['DEFAULT']['deviceId'] = newDeviceId
	with open('config.ini', 'w') as configfile:
		config.write(configfile)

def getBusById(busId):
	for bus in bus_options:
		if bus['id'] == busId:
			return bus

def hex_to_rgb(hex_string):
	hex_string = hex_string.lstrip('#')
	return tuple(int(hex_string[i:i+2], 16) for i in (0, 2, 4))

def processTallyData():
	busses_list = []
	for device_state in device_states:
		current_bus = getBusById(device_state['busId'])
		if len(device_state['sources']) > 0:
			busses_list.append(current_bus)
	
	if len(busses_list) == 0:
		debug("Bus: nothing")
		doBlink(0,0,0)
	else:
		try:
			busses_list.sort(key=lambda x: x['priority'])
		except:
			return
		current_color = hex_to_rgb(busses_list[0]['color'])
		debug('Bus: ' + busses_list[0]['type'] + ' - ' + ";".join(str(n) for n in current_color))
		doBlink(*current_color)
	debug()

def doBlink(r, g, b):
	global debounce, args
	if (debounce != True):
		debounce = True
		if b1:
			b1.fade_to_rgb(100, r, g, b)
		elif args.skip_blink1:
			print("\033[38;2;{};{};{}m{} \033[38;2;255;255;255m".format(r, g, b, " blink1 color"))
		debounce = False

while(1):
	try:
		sio.connect('http://' + args.host + ':' + args.port)
		sio.wait()
		print('Tally Arbiter Listener Running. Press CTRL-C to exit.')
		print('Attempting to connect to Tally Arbiter server: ' + args.host + '(' + args.port + ')')
		print()
	except KeyboardInterrupt:
		print('Exiting Tally Arbiter Listener.')
		doBlink(0, 0, 0)
		exit(0)
	except socketio.exceptions.ConnectionError:
		doBlink(0, 0, 0)
		time.sleep(15)
	except:
		print("Unexpected error:", sys.exc_info()[0])
		print('An error occurred internally.')
		doBlink(0, 0, 0)
