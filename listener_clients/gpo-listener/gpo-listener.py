#!/usr/bin/env python3

## Tally Arbiter GPO Controller

from signal import signal, SIGINT
from sys import exit
import sys
import os
import shutil
import time
from uuid import uuid4
import socketio
import json
import atexit
import argparse

parser = argparse.ArgumentParser(description='Tally Arbiter Blink(1) Listener')
parser.add_argument('--ip', help='Hostname or IP address of the server')
parser.add_argument('--port', help='Port of the server')
parser.add_argument('--config', default='config_gpo.json', help='Load with custom device id')
parser.add_argument('--disable-reassign', action='store_true', help='Disable device reassignmend from UI')
parser.add_argument('--disable-flash', action='store_true', help='Disable client listener flash')
parser.add_argument('--skip-gpio', action='store_true', help='Skip the Rpi.GPIO requirment and simulate it (only for debugging)')
args = parser.parse_args()

configFileName = args.config

server_config = []
gpo_groups = []

device_states = []
bus_options = []

try:
	if configFileName == 'config_gpo.json' and not os.path.isfile('config_gpo.json'):
		shutil.copyfile(configFileName + '.example', configFileName)
		print('config_gpo.json does not exist, creating a new one.')
	
	config_file = open(configFileName)
	config = config_file.read()
	config_file.close()
	if (config != ''):
		configJson = json.loads(config)
		if not 'clientUUID' in configJson:
			configJson['clientUUID'] = str(uuid4())
			with open('config_gpo.json', 'w') as outfile:
				json.dump(configJson, outfile, indent=4)
		server_config = configJson['server_config']
		gpo_groups = configJson['gpo_groups']
	else:
		print('Config data could not be loaded.')
		exit (0)
except IOError:
	print('Config file could not be located.')
	exit (0)

if args.ip:
	server_config['ip'] = args.ip

if args.port:
	server_config['port'] = args.port

class GPIOsimulator:
	BCM = "BCM"
	OUT = "OUT"

	def setmode(self, mode):
		print('Setting GPIO mode to {}'.format(mode))
	
	def setwarnings(self, state):
		print('Setting GPIO warnings to {}'.format(state))

	def setup(self, pin, mode):
		print('Setting GPIO pin {} to mode {}'.format(pin, mode))
	
	def output(self, pin, state):
		pass
		#print('Setting GPIO pin {} to state {}'.format(pin, state))

try:
	import RPi.GPIO as GPIO # pyright: reportMissingImports=false
except ImportError:
	GPIO = GPIOsimulator()
	if not args.skip_gpio:
		print("Rpi.GPIO is not found. Please install it and try again.")
		print("If you want to try this program simulating GPIO add the flag --skip-gpio")
		exit(1)

def setStates():
	GPIO.setmode(GPIO.BCM)
	GPIO.setwarnings(False)

	for gpo_group in gpo_groups:
		for gpo in gpo_group['gpos']:
			GPIO.setup(gpo['pinNumber'], GPIO.OUT)
			GPIO.output(gpo['pinNumber'], False)
			gpo['state'] = False
	
	atexit.register(GPO_off)

def GPO_off():
	print('Setting all GPOs to low before exiting.')
	for gpo_group in gpo_groups:
		for gpo in gpo_group['gpos']:
			GPIO.setup(gpo['pinNumber'], GPIO.OUT)
			GPIO.output(gpo['pinNumber'], False)
			gpo['state'] = False

#SocketIO Connections
sio = socketio.Client()

@sio.event
def connect():
	print('Connected to Tally Arbiter server:', server_config['ip'], server_config['port'])
	sio.emit('bus_options')
	setStates()
	for gpo_group in gpo_groups:
		sio.emit('listenerclient_connect', {  # start listening for the device
			'deviceId': gpo_group['deviceId'],
			'listenerType': 'gpo_' + configJson['clientUUID'] + "_" + gpo_group['id'],
			'canBeReassigned': not args.disable_reassign,
			'canBeFlashed': not args.disable_flash,
			'supportsChat': False
		})

@sio.event
def connect_error(data):
	print('Unable to connect to Tally Arbiter server:', server_config['ip'], server_config['port'])

@sio.event
def disconnect():
	print('Disconnected from Tally Arbiter server:', server_config['ip'], server_config['port'])

@sio.event
def reconnect():
	print('Reconnected to Tally Arbiter server:', server_config['ip'], server_config['port'])

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
	bus_options = data

@sio.on('flash')
def on_flash(gpoGroupId):
	if args.disable_flash:
		return
	for gpo_group in gpo_groups:
		if gpo_group['id'] == gpoGroupId:
			for gpo in gpo_group['gpos']:
				GPIO.output(gpo['pinNumber'], True)
				time.sleep(.5)
				GPIO.output(gpo['pinNumber'], False)
				time.sleep(.5)
				GPIO.output(gpo['pinNumber'], True)
				time.sleep(.5)
				GPIO.output(gpo['pinNumber'], False)
				time.sleep(.5)
				GPIO.output(gpo['pinNumber'], gpo['state'])

@sio.on('reassign')
def on_reassign(oldDeviceId, newDeviceId):
	if args.disable_reassign:
		return
	print('Reassigning GPO Group from DeviceID: ' + oldDeviceId + ' to Device ID: ' + newDeviceId)
	for gpo_group in gpo_groups:
		if gpo_group['deviceId'] == oldDeviceId:
			gpo_group['deviceId'] = newDeviceId

	config_file = open(configFileName, 'w')
	configJson = {}
	configJson['server_config'] = server_config
	configJson['gpo_groups'] = gpo_groups
	config_file.write(json.dumps(configJson, indent=4))
	config_file.close()

def getBusTypeById(busId):
	for bus in bus_options:
		if bus['id'] == busId:
			return bus['type']

def processTallyData():
	for device_state in device_states:
		if getBusTypeById(device_state['busId']) == 'preview':
			if len(device_state['sources']) > 0:
				print('Updating GPO: {} is in preview'.format(device_state['deviceId']))
				UpdateGPO(device_state['deviceId'], 'preview', True)
			else:
				print('Updating GPO: {} is NOT in preview'.format(device_state['deviceId']))
				UpdateGPO(device_state['deviceId'], 'preview', False)
		elif getBusTypeById(device_state['busId']) == 'program':
			if len(device_state['sources']) > 0:
				print('Updating GPO: {} is in program'.format(device_state['deviceId']))
				UpdateGPO(device_state['deviceId'], 'program', True)
			else:
				print('Updating GPO: {} is NOT in program'.format(device_state['deviceId']))
				UpdateGPO(device_state['deviceId'], 'program', False)

def UpdateGPO(deviceId, bus, value):
	for gpo_group in gpo_groups:
		if gpo_group['deviceId'] == deviceId:
			for gpo in gpo_group['gpos']:
				if gpo['busType'] == bus:
					if value == True:
						# turn the pin high
						print('Taking GPIO Pin {} High'.format(gpo['pinNumber']))
						GPIO.output(gpo['pinNumber'], True)
						gpo['state'] = True
					else:
						# turn the pin low
						print('Taking GPIO Pin {} Low'.format(gpo['pinNumber']))
						GPIO.output(gpo['pinNumber'], False)
						gpo['state'] = False

while(1):
	try:
		sio.connect('http://' + server_config['ip'] + ':' + str(server_config['port']))
		sio.wait()
		print('Tally Arbiter GPO Listener Running. Press CTRL-C to exit.')
		print('Attempting to connect to Tally Arbiter server: {}:{}', server_config['ip'], str(server_config['port']))
	except KeyboardInterrupt:
		print('Exiting Tally Arbiter GPO Listener.')
		exit(0)
	except socketio.exceptions.ConnectionError:
		time.sleep(15)
	except:
		print("Unexpected error:", sys.exc_info()[0])
		print('An error occurred internally.')
		exit(0)
