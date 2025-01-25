/* Tally Arbiter Relay Controller */

//General Variables
const clc = require('cli-color')
const io = require('socket.io-client')
const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const config_file = './config_relays.json' //local storage JSON file
const USBRelay = require('@josephdadams/usbrelay')
const bonjour = require('bonjour')()

//var relay = 		null;
var detectedRelays = []

var configJson = {}
var relay_groups = []
var server_config = {}

var socket = null

var currentRelayGroup

var device_states = []
var bus_options = []

function startUp() {
	loadConfig()
	setupUSBRelay()
	openSocket()
}

function loadConfig() {
	//if config_relays.json not exists, copy from config_relays.json.example
	if (config_file == './config_relays.json' && !fs.existsSync(config_file)) {
		fs.copyFileSync(config_file + '.example', config_file)
	}
	try {
		let rawdata = fs.readFileSync(config_file)
		configJson = JSON.parse(rawdata)

		if (configJson.relay_groups) {
			relay_groups = configJson.relay_groups
			logger('Tally Arbiter Relay Groups loaded.', 'info')
		} else {
			relay_groups = []
			logger('Tally Arbiter Relay Groups could not be loaded.', 'error')
		}
		if (configJson.server_config) {
			server_config = configJson.server_config
			logger('Tally Arbiter Server Config loaded.', 'info')
		} else {
			server_config = []
			logger('Tally Arbiter Server Config could not be loaded.', 'error')
		}
		if (!configJson.clientUUID || configJson.clientUUID == '' || !configJson.server_config.useMDNS) {
			saveConfig()
		}
	} catch (error) {
		if (error.code === 'ENOENT') {
			logger('The config file could not be found.', 'error')
		} else {
			logger('An error occurred while loading the configuration file:', 'error')
			logger(error, 'error')
		}
	}
}

function saveConfig() {
	try {
		if (!server_config.ip) server_config.ip = '127.0.0.1'
		if (!server_config.port) server_config.port = '4455'
		if (server_config.useMDNS == null || undefined) server_config.useMDNS = true

		if (!configJson.clientUUID) configJson.clientUUID = uuidv4()

		configJson = {
			server_config: server_config,
			relay_groups: relay_groups,
			clientUUID: configJson.clientUUID,
		}

		fs.writeFileSync(config_file, JSON.stringify(configJson, null, 1), 'utf8', function (error) {
			if (error) {
				result.error = 'Error saving configuration to file: ' + error
			}
		})
	} catch (error) {
		result.error = 'Error saving configuration to file: ' + error
	}
}

class USBRelaysimulator {
	relays = []

	static get Relays() {
		return [
			{
				vendorId: 1234,
				productId: 6789,
				path: 'EXAMPLE_PATH',
				serial: 'ABCDEFGHI',
				manufacturer: 'TallyArbiter',
				product: 'simulated USBRelay',
				release: 1,
				interface: -1,
				usagePage: 1,
				usage: 1,
			},
		]
	}

	constructor(devicePath) {
		logger('Error updating relay state: No USB relays have been initialized. Are you sure it is connected?', 'error')
	}

	setState(relayNumber, state) {
		this.relays[relayNumber - 1] = state
	}

	getState(relayNumber) {
		let relayIndex = relayNumber - 1
		if (relayIndex < 0 || relayIndex > 7) {
			throw new Error('Invalid relayNumber must be between 1 and 8')
		}
		return this.relays[relayIndex] || false //returns false if false or undefined and true if true
	}

	getSerialNumber() {
		return 'ABCDEFGHI'
	}
}

function setupUSBRelay() {
	try {
		//relay = new USBRelay();
		detectedRelays = USBRelay.Relays
		console.log('Detected Relays:')
		console.log(detectedRelays)
		if (detectedRelays.length > 0) {
			for (let i = 0; i < detectedRelays.length; i++) {
				detectedRelays[i].relay = new USBRelay(detectedRelays[i].path)
			}
		} else {
			logger('No USB Relays detected.', 'error')
			detectedRelays.push(new USBRelaysimulator())
		}
	} catch (error) {
		if (error.message == 'No USB Relays are connected.') logger(error, 'error')
		detectedRelays.push(new USBRelaysimulator())
	}
}

function logger(log, type) {
	//logs the item to the console

	let dtNow = new Date()

	switch (type) {
		case 'info':
			console.log(clc.black(`[${dtNow}]`) + '     ' + clc.blue(log))
			break
		case 'error':
			console.log(clc.black(`[${dtNow}]`) + '     ' + clc.red.bold(log))
			break
		case 'debug':
			console.log(clc.black(`[${dtNow}]`) + '     ' + clc.green.bold(log))
			break
		default:
			console.log(clc.black(`[${dtNow}]`) + '     ' + log)
			break
	}
}

function connectToServer(ip, port) {
	logger(`Connecting to Tally Arbiter server: ${ip}:${port}`, 'info')
	socket = io.connect('http://' + ip + ':' + port, { reconnect: true })

	socket.on('connect', function () {
		logger('Connected to Tally Arbiter server.', 'info')
	})

	socket.on('disconnect', function () {
		logger('Disconnected from Tally Arbiter server.', 'error')
		//attempt to reconnect after 5 seconds
		setTimeout(function () {
			openSocket()
		}, 5000)
	})

	socket.on('error', function (error) {
		logger(error, 'error')
	})

	socket.on('device_states', function (Device_states) {
		//process the data received and determine if it's in preview or program and adjust the relays accordingly
		device_states = Device_states
		ProcessTallyData(device_states)
	})

	socket.on('bus_options', function (Bus_options) {
		bus_options = Bus_options
	})

	socket.on('flash', function (relayGroupId) {
		//flash the specific relay group
		FlashRelayGroup(relayGroupId)
		logger(`Flash received for Relay Group: ${relayGroupId}`)
	})

	socket.on('reassign', function (oldDeviceId, newDeviceId, relayGroupId) {
		//reassign the relay to a new device
		for (let i = 0; i < relay_groups.length; i++) {
			if (relay_groups[i].id === relayGroupId) {
				relay_groups[i].deviceId = newDeviceId
				logger(
					`Device ${oldDeviceId} (relay group ${relayGroupId}) has been reassigned to Device ${newDeviceId}`,
					'info',
				)
				saveConfig()

				socket.emit('listener_reassign_relay', relayGroupId, oldDeviceId, newDeviceId);
			}
		}
	})

	for (let i = 0; i < relay_groups.length; i++) {
		socket.emit('listenerclient_connect', {
			deviceId: relay_groups[i].deviceId,
			internalId: relay_groups[i].id,
			listenerType: 'relay_' + configJson.clientUUID + '_' + relay_groups[i].id,
			canBeReassigned: true,
			canBeFlashed: true,
			supportsChat: false,
		})
	}
}
function openSocket() {
	//listen for device states emit, bus types, reassign, flash
	//for loop through every relay_group item and make a new socket connection for each

	let ip = server_config.ip
	let port = server_config.port

	if (!port) {
		port = 4455
	}

	if (server_config.useMDNS) {
		bonjour.findOne({ type: 'tally-arbiter' }, function (service) {
			ip = service.host
			port = service.port
			if (service.txt.version.startsWith('2.')) {
				logger(
					`Error connecting to Tally Arbiter: Tally Arbiter server version ${service.txt.version} is not supported.`,
					'error',
				)
				process.exit(3)
			}
			logger(`Found TallyArbiter server using MDNS: ${ip}:${port}`, 'info')
			connectToServer(ip, port)
		})
	} else if (ip) {
		logger(`Reading TallyArbiter server connection info from config: ${ip}:${port}`, 'info')
		connectToServer(ip, port)
	}
}

function getBusTypeById(busId) {
	//gets the bus type (preview/program) by the bus id
	let bus = bus_options.find(({ id }) => id === busId)

	return bus.type
}

function getRelayGroupById(deviceId) {
	let groupIndex
	for (i = 0; i < relay_groups.length; i++) {
		if (relay_groups[i].deviceId == deviceId) {
			groupIndex = i
			break
		}
	}
	currentRelayGroup = relay_groups[groupIndex]
	return relay_groups[groupIndex]
}

function ProcessTallyData(states) {
	if (bus_options.length > 0) {
		let powered_relays = []
		let deviceId
		states.forEach((device_state) => {
			deviceId = device_state.deviceId
			if (device_state.sources.length > 0) {
				logger(device_state.deviceId + ' ' + getBusTypeById(device_state.busId), 'debug')
				let relay_group = getRelayGroupById(device_state.deviceId)
				if (typeof relay_group !== 'undefined' && device_state.deviceId === relay_group.deviceId) {
					relay_group.relays.forEach((currentRelay) => {
						if (currentRelay.busType === getBusTypeById(device_state.busId)) {
							logger('Relay ' + currentRelay.relaySerial + ':' + currentRelay.relayNumber + ' is on', 'debug')
							relaySetState(currentRelay.relaySerial, currentRelay.relayNumber, true)
							powered_relays.push(currentRelay.relayNumber)
						}
					})
				}
			}
		})
		relay_groups.forEach(function (relay_group) {
			if (relay_group.deviceId === deviceId) {
				relay_group.relays.forEach(function (currentRelay) {
					if (!powered_relays.includes(currentRelay.relayNumber)) {
						logger('Relay ' + currentRelay.relaySerial + ':' + currentRelay.relayNumber + ' is off', 'debug')
						relaySetState(currentRelay.relaySerial, currentRelay.relayNumber, false)
					}
				})
			}
		})
	}
}

function FlashRelayGroup(relayGroupId) {
	for (let i = 0; i < relay_groups.length; i++) {
		if (relay_groups[i].id === relayGroupId) {
			for (let j = 0; j < relay_groups[i].relays.length; j++) {
				let currentRelay = relay_groups[i].relays[j]
				let oldState = relayGetState(currentRelay.relaySerial, currentRelay.relayNumber)
				relaySetState(currentRelay.relaySerial, currentRelay.relayNumber, true)
				setTimeout(function () {
					relaySetState(currentRelay.relaySerial, currentRelay.relayNumber, false)
					setTimeout(function () {
						relaySetState(currentRelay.relaySerial, currentRelay.relayNumber, true)
						setTimeout(function () {
							relaySetState(currentRelay.relaySerial, currentRelay.relayNumber, false)
							setTimeout(function () {
								relaySetState(currentRelay.relaySerial, currentRelay.relayNumber, oldState)
							}, 500)
						}, 500)
					}, 500)
				}, 500)
			}
			break
		}
	}
}

function relaySetState(relaySerial, relayNumber, state) {
	//sets the state of a relay
	if (relaySerial !== null) {
		//loop through array of relays and determine which one to set
		for (let i = 0; i < detectedRelays.length; i++) {
			if (detectedRelays[i].serial === relaySerial) {
				//set the relay state
				console.log('setting relay state: ' + relaySerial + ': ' + relayNumber + ' to ' + state)
				detectedRelays[i].relay.setState(relayNumber, state)
				break
			}
		}
	} else {
		if (detectedRelays.length > 0) {
			logger('Error setting relay state: No USB relays have been initialized. Are you sure it is connected?', 'error')
		}
	}
}

function relayGetState(relaySerial, relayNumber) {
	//gets the state of a relay
	let currentState = false

	if (relaySerial !== null) {
		//loop through array of relays and determine which one to set
		for (let i = 0; i < detectedRelays.length; i++) {
			if (detectedRelays[i].serial === relaySerial) {
				currentState = detectedRelays[i].relay.getState(relayNumber)
				break
			}
		}
	} else {
		if (detectedRelays.length > 0) {
			logger('Error setting relay state: No USB relays have been initialized. Are you sure it is connected?', 'error')
		}
	}

	return currentState
}

startUp()
