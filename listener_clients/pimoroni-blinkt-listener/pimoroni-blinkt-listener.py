## Tally Arbiter Pimoroni Blinkt Listener

from signal import signal, SIGINT
from sys import exit
import sys
import time
from blinkt import set_pixel, set_brightness, show, clear
import socketio
import json

device_states = []
bus_options = []
mode_preview = False
mode_program = False

server = sys.argv[1]

stored_deviceId = ''

try:
	stored_deviceId_file = open('deviceid.txt')
	stored_deviceId = stored_deviceId_file.read()
	stored_deviceId_file.close()
except IOError:
	stored_deviceId = ''

print('Last Used Device Id: ' + stored_deviceId)

if len(sys.argv) > 2:
	port = sys.argv[2]
else:
	port = '4455'

if len(sys.argv) > 3:
	deviceId = sys.argv[3]
else:
	if (stored_deviceId != ''):
		deviceId = stored_deviceId
	else:
		deviceId = 'null'

#SocketIO Connections
sio = socketio.Client()

@sio.event
def connect():
	print('Connected to Tally Arbiter server:', server, port)
	sio.emit('bus_options')												# get current bus options
	sio.emit('device_listen_blink', {'deviceId': deviceId})			# start listening for the device
	repeatNumber = 2
	while(repeatNumber):
		repeatNumber = repeatNumber - 1
		doBlink(0, 255, 0)
		time.sleep(.3)
		doBlink(0, 0, 0)
		time.sleep(.3)

@sio.event
def connect_error(data):
	print('Unable to connect to Tally Arbiter server:', server, port)
	doBlink(150, 150, 150)
	time.sleep(.3)
	doBlink(0, 0, 0)
	time.sleep(.3)

@sio.event
def disconnect():
	print('Disconnected from Tally Arbiter server:', server, port)
	doBlink(255, 255, 255)
	time.sleep(.3)
	doBlink(0, 0, 0)
	time.sleep(.3)

@sio.event
def reconnect():
	print('Reconnected to Tally Arbiter server:', server, port)
	repeatNumber = 2
	while(repeatNumber):
		repeatNumber = repeatNumber - 1
		doBlink(0, 255, 0)
		time.sleep(.3)
		doBlink(0, 0, 0)
		time.sleep(.3)

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
def on_flash():
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
	evaluateMode()

@sio.on('reassign')
def on_reassign(oldDeviceId, newDeviceId):
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
	global deviceId
	deviceId = newDeviceId
	stored_deviceId_file = open('deviceid.txt', 'w')
	stored_deviceId_file.write(newDeviceId)
	stored_deviceId_file.close()

def getBusTypeById(busId):
	for bus in bus_options:
		if bus['id'] == busId:
			return bus['type']

def processTallyData():
	global mode_preview
	global mode_program
	for device_state in device_states:
		if getBusTypeById(device_state['busId']) == 'preview':
			if len(device_state['sources']) > 0:
				mode_preview = True
			else:
				mode_preview = False
		elif getBusTypeById(device_state['busId']) == 'program':
			if len(device_state['sources']) > 0:
				mode_program = True
			else:
				mode_program = False
	evaluateMode()

def evaluateMode():
	if (mode_preview == True) and (mode_program == False):		# preview mode, color it green
		doBlink(0, 255, 0)
	elif (mode_preview == False) and (mode_program == True):	# program mode, color it red
		doBlink(255, 0, 0)
	elif (mode_preview == True) and (mode_program == True):		# preview+program mode, color it yellow
		doBlink(255, 255, 0)
	else:														# no source, turn it off
		doBlink(0, 0, 0)

def doBlink(r, g, b):
	clear()
	for i in range(8):
		set_pixel(i, r, g, b)
	show()

while(1):
	try:
		sio.connect('http://' + server + ':' + port)
		sio.wait()
		print('Tally Arbiter Listener Running. Press CTRL-C to exit.')
		print('Attempting to connect to Tally Arbiter server: ' + server + '(' + port + ')')
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
