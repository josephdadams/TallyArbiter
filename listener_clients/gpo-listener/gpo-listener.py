#!/usr/bin/env python3

## Tally Arbiter GPO Controller

from signal import signal, SIGINT
from sys import exit
import sys
import time
import socketio
import json
import atexit
import RPi.GPIO as GPIO

configFileName = 'config_gpo.json'
server_config = []
gpo_groups = []

device_states = []
bus_options = []

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
		sio.emit('device_listen_gpo', {'gpoGroupId': gpo_group['id'], 'deviceId': gpo_group['deviceId']})

@sio.event
def connect_error(data):
	print('Unable to connect to Tally Arbiter server:', server_config['ip'], server_config['port'])

@sio.event
def disconnect():
	print('Disconnected from Tally Arbiter server:', server_config['ip'], server_config['port'])

@sio.event
def reconnect():
	print('Reconnected to Tally Arbiter server:', server_config['ip'], server_config['port'])

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
def on_reassign(gpoGroupId, oldDeviceId, newDeviceId):
	print('Reassigning GPO Group ' + gpoGroupId + ' from DeviceID: ' + oldDeviceId + ' to Device ID: ' + newDeviceId)
	sio.emit('listener_reassign_gpo', data=(gpoGroupId, oldDeviceId, newDeviceId))
	for gpo_group in gpo_groups:
		if gpo_group['id'] == gpoGroupId:
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

try:
	config_file = open(configFileName)
	config = config_file.read()
	config_file.close()
	if (config != ''):
		configJson = json.loads(config)
		server_config = configJson['server_config']
		gpo_groups = configJson['gpo_groups']
	else:
		print('Config data could not be loaded.')
		exit (0)
except IOError:
	print('Config file could not be located.')
	exit (0)

try:
	sio.connect('http://' + server_config['ip'] + ':' + str(server_config['port']))
	sio.wait()
	print('Tally Arbiter GPO Controller Running. Press CTRL-C to exit.')
	print('Attempting to connect to Tally Arbiter server: {}:{}', server_config['ip'], str(server_config['port']))
except KeyboardInterrupt:
	print('Exiting Tally Arbiter GPO Controller.')
except:
	print('An error occurred internally.')
	exit (0)