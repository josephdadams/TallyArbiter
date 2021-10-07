/* Tally Arbiter Relay Controller */

//General Variables
const clc = 	 	   require('cli-color');
const io = 			   require('socket.io-client');
const fs = 			   require('fs');
const path = 		   require('path');
const { v4: uuidv4 } = require('uuid');
const config_file =    './config_relays.json'; //local storage JSON file
const USBRelay = 	   require('@josephdadams/usbrelay');

var relay = 		null;

var configJson = {};
var relay_groups = 	[];
var server_config =	[];

var socket = 		null;

var device_states =	[];
var bus_options =	[];

function startUp() {
	loadConfig();
	setupUSBRelay();
	openSocket();
}

function loadConfig() {
	//if config_relays.json not exists, copy from config_relays.json.example
	if(config_file == "./config_relays.json" && !fs.existsSync(config_file)) {
		fs.copyFileSync(config_file + '.example', config_file);
	}
	try {
		let rawdata = fs.readFileSync(config_file);
		configJson = JSON.parse(rawdata); 

		if (configJson.relay_groups) {
			relay_groups = configJson.relay_groups;
			logger('Tally Arbiter Relay Groups loaded.', 'info');
		}
		else {
			relay_groups = [];
			logger('Tally Arbiter Relay Groups could not be loaded.', 'error');
		}
		if (configJson.server_config) {
			server_config = configJson.server_config;
			logger('Tally Arbiter Server Config loaded.', 'info');
		}
		else {
			server_config = [];
			logger('Tally Arbiter Server Config could not be loaded.', 'error');
		}
		if(!configJson.clientUUID) {
			saveConfig();
		}
	}
	catch (error) {
		if (error.code === 'ENOENT') {
			logger('The config file could not be found.', 'error');
		}
		else {
			logger('An error occurred while loading the configuration file:', 'error');
			logger(error, 'error');
		}
	}
}

function saveConfig() {
	try {
		configJson = {
			server_config: server_config,
			relay_groups: relay_groups,
			clientUUID: uuidv4()
		};

		fs.writeFileSync(config_file, JSON.stringify(configJson, null, 1), 'utf8', function(error) {
			if (error)
			{ 
				result.error = 'Error saving configuration to file: ' + error;
			}
		});	
	}
	catch (error) {
		result.error = 'Error saving configuration to file: ' + error;
	}
}

class USBRelaysimulator
{
	relays = [];

    static get Relays() {
        return [
			{
				vendorId: 1234,
				productId: 6789,
				path: 'EXAMPLE_PATH',
				manufacturer: 'TallyArbiter',
				product: 'simulated USBRelay',
				release: 1,
				interface: -1,
				usagePage: 1,
				usage: 1
			}
		];
    }
        
    constructor(devicePath) {
		logger('Error updating relay state: No USB relays have been initialized. Are you sure it is connected?', 'error');
	}
    
    setState(relayNumber, state) {
		this.relays[relayNumber-1] = state;
    }

    getState(relayNumber) {
        let relayIndex = relayNumber-1;
        if(relayIndex<0 || relayIndex>7){
            throw new Error('Invalid relayNumber must be between 1 and 8');
        }
        return this.relays[relayIndex] || false; //returns false if false or undefined and true if true
    }

    getSerialNumber() {
		return 'ABCDEFGHI';
    }
}

function setupUSBRelay() {
	try {
		relay = new USBRelay();
	}
	catch (error) {
		if(error.message == 'No USB Relays are connected.')	logger(error, 'error');
		relay = new USBRelaysimulator();
	}
}

function logger(log, type) {
	//logs the item to the console

	let dtNow = new Date();

	switch(type) {
		case 'info':
			console.log(clc.black(`[${dtNow}]`) + '     ' + clc.blue(log));
			break;
		case 'error':
			console.log(clc.black(`[${dtNow}]`) + '     ' + clc.red.bold(log));
			break;
		case 'debug':
			console.log(clc.black(`[${dtNow}]`) + '     ' + clc.green.bold(log));
			break;
		default:
			console.log(clc.black(`[${dtNow}]`) + '     ' + log);
			break;
	}
}

function openSocket() {
	//listen for device states emit, bus types, reassign, flash
	//for loop through every relay_group item and make a new socket connection for each

	let ip = server_config.ip;
	let port = server_config.port;

	if (!port) {
		port = 4455;
	}

	if (ip) {
		logger(`Connecting to Tally Arbiter server: ${ip}:${port}`, 'info');
		socket = io.connect('http://' + ip + ':' + port, {reconnect: true});

		socket.on('connect', function(){
			logger('Connected to Tally Arbiter server.', 'info');
		});

		socket.on('disconnect', function(){
			logger('Disconnected from Tally Arbiter server.', 'error');
		});

		socket.on('error', function(error){
			logger(error, 'error');
		});

		socket.on('device_states', function(Device_states) {
			//process the data received and determine if it's in preview or program and adjust the relays accordingly
			device_states = Device_states;
			ProcessTallyData();
		});

		socket.on('bus_options', function(Bus_options) {
			bus_options = Bus_options;
		});

		socket.on('flash', function(relayGroupId) {
			//flash the specific relay group
			FlashRelayGroup(relayGroupId);
			logger(`Flash received for Relay Group: ${relayGroupId}`);
		});

		socket.on('reassign', function(oldDeviceId, newDeviceId, relayGroupId) {
			//reassign the relay to a new device
			for (let i = 0; i < relay_groups.length; i++) {
				if (relay_groups[i].id === relayGroupId) {
					relay_groups[i].deviceId = newDeviceId;
					logger(`Device ${oldDeviceId} (relay group ${relayGroupId}) has been reassigned to Device ${newDeviceId}`, 'info');
					saveConfig();
				}
			}
		});

		for(let i = 0; i < relay_groups.length; i++) {
			socket.emit('listenerclient_connect', {
				'deviceId': relay_groups[i].deviceId,
				'internalId': relay_groups[i].id,
				'listenerType': 'relay_' + configJson.clientUUID + '_' + relay_groups[i].id,
				'canBeReassigned': true,
				'canBeFlashed': true,
				'supportsChat': false
			});
		}
	}
}

function getBusTypeById(busId) {
	//gets the bus type (preview/program) by the bus id
	let bus = bus_options.find( ({ id }) => id === busId);

	return bus.type;
}

function ProcessTallyData() {
	if(bus_options.length > 0) {
		let powered_relays = [];
		device_states.forEach(function(device_state) {
			if (device_state.sources.length > 0) {
				//logger(device_state.deviceId + " " + getBusTypeById(device_state.busId), 'debug');
				relay_groups.forEach(function(relay_group) {
					if(device_state.deviceId === relay_group.deviceId) {
						relay_group.relays.forEach(function(currentRelay) {
							if(currentRelay.busType === getBusTypeById(device_state.busId)) {
								logger("Relay " + currentRelay.relayNumber + " is on", 'debug');
								relay.setState(currentRelay.relayNumber, true);
								powered_relays.push(currentRelay.relayNumber);
							}
						});
					}
				});
			}
		});
		relay_groups.forEach(function(relay_group) {
			relay_group.relays.forEach(function(currentRelay) {
				if(!powered_relays.includes(currentRelay.relayNumber)) {
					logger("Relay " + currentRelay.relayNumber + " is off", 'debug');
					relay.setState(currentRelay.relayNumber, false);
				}
			});
		});
	}
}

function FlashRelayGroup(relayGroupId) {
	for (let i = 0; i < relay_groups.length; i++) {
		if (relay_groups[i].id === relayGroupId) {
			for (let j = 0; j < relay_groups[i].relays.length; j++) {
				let oldState = relay.getState(relay_groups[i].relays[j].relayNumber);
				relay.setState(relay_groups[i].relays[j].relayNumber, true);
				setTimeout(function () {
					relay.setState(relay_groups[i].relays[j].relayNumber, false);
					setTimeout(function () {
						relay.setState(relay_groups[i].relays[j].relayNumber, true);
						setTimeout(function () {
							relay.setState(relay_groups[i].relays[j].relayNumber, false);
							setTimeout(function () {
								relay.setState(relay_groups[i].relays[j].relayNumber, oldState);
							}, 500);
						}, 500)
					}, 500);
				}, 500);
			}
			break;
		}
	}
}

startUp();