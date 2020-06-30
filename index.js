/* Tally Arbiter */

//Protocol, Network, Socket, Server libraries/variables
const net 			= require('net');
const packet 		= require('packet');
const TSLUMD 		= require('tsl-umd'); // TSL UDP package
const dgram 		= require('dgram');
const ATEM 			= require('atem');
const OBS 			= require('obs-websocket-js');
const fs 			= require('fs');
const path 			= require('path');
const {version} 	= require('./package.json');
const isPi 			= require('detect-rpi');
const clc 			= require('cli-color');
const util 			= require ('util');
const express 		= require('express');
const bodyParser 	= require('body-parser');
const app 			= express();
const axios 		= require('axios');
const httpServer 	= require('http').Server(app);
const io 			= require('socket.io')(httpServer);

//Tally Arbiter variables
const listenPort 	= 4455;
const config_file 	= './config.json'; //local storage JSON file
var Clients 		= []; //array of connected listener clients (web, python, relay, etc.)
var Logs 			= []; //array of actions, information, and errors

var source_types 	= [ //available tally source types
	{ id: '5e0a1d8c', label: 'TSL 3.1 UDP', type: 'tsl_31_udp', enabled: true, help: ''},
	{ id: 'dc75100e', label: 'TSL 3.1 TCP', type: 'tsl_31_tcp', enabled: true , help: ''},
	{ id: '44b8bc4f', label: 'Blackmagic ATEM', type: 'atem', enabled: true, help: 'Uses Port 9910.' },
	{ id: '4eb73542', label: 'OBS Studio', type: 'obs', enabled: true, help: 'The OBS Websocket plugin must be installed on the source.'},
	{ id: '58b6af42', label: 'VMix', type: 'vmix', enabled: true },
	{ id: '4a58f00f', label: 'Roland Smart Tally', type: 'roland', enabled: true },
	{ id: 'cf51e3c9', label: 'Incoming Webhook', type: 'webhook', enabled: false, help: ''}
];

var source_types_datafields = [ //data fields for the tally source types
	{ sourceTypeId: '5e0a1d8c', fields: [ //TSL 3.1 UDP
			{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'number' }
		]
	},
	{ sourceTypeId: 'dc75100e', fields: [ //TSL 3.1 TCP
			{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'number' }
		]
	},
	{ sourceTypeId: '44b8bc4f', fields: [ //Blackmagic ATEM
			{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' }
		]
	},
	{ sourceTypeId: '4eb73542', fields: [ // OBS Studio
			{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'number' },
			{ fieldName: 'password', fieldLabel: 'Password', fieldType: 'text' }
		]
	},
	{ sourceTypeId: '58b6af42', fields: [ // VMix
			{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' }
		]
	},
	{ sourceTypeId: '4a58f00f', fields: [ // Roland Smart Tally
			{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' }
		]
	},
	{ sourceTypeId: 'cf51e3c9', fields: [ //Incoming Webhook
			{ fieldName: 'path', fieldLabel: 'Webhook path', fieldType: 'text' }
		]
	}
];

if (isPi()) {
	//adds the GPIO input type option if the software is running on a Raspberry Pi
	let sourceTypeObj = {};
	sourceTypeObj.id = 'bc0d5c91';
	sourceTypeObj.label = 'Local GPIO';
	sourceTypeObj.type = 'gpio';
	sourceTypeObj.enabled = false;
	source_types.push(sourceTypeObj);

	let sourceTypeDataFieldObj = {};
	sourceTypeDataFieldObj.sourceTypeId = sourceTypeObj.id;
	let fields = [
		{ fieldName: 'pins', fieldLabel: 'GPIO Pins', fieldType: 'text' }
	];
	sourceTypeDataFieldObj.fields = fields;
	source_types_datafields.push(sourceTypeDataFieldObj);
}

var output_types = [ //output actions that Tally Arbiter can perform
	{ id: '7dcd66b5', label: 'TSL 3.1 UDP', type: 'tsl_31_udp', enabled: true},
	{ id: '276a8dcc', label: 'TSL 3.1 TCP', type: 'tsl_31_tcp', enabled: true },
	{ id: 'ffe2b0b6', label: 'Outgoing Webhook', type: 'webhook', enabled: true},
	{ id: '6dbb7bf7', label: 'Local Console Output', type: 'console', enabled: true }
];

var output_types_datafields = [ //data fields for the outgoing actions
	{ outputTypeId: '7dcd66b5', fields: [ //TSL 3.1 UDP
			{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'number' },
			{ fieldName: 'address', fieldLabel: 'Address', fieldType: 'number' },
			{ fieldName: 'label', fieldLabel: 'Label', fieldType: 'text' },
			{ fieldName: 'tallynumber', fieldLabel: 'Tally Number', fieldType: 'dropdown', options: [ {id: '1', label: 'Tally 1 (PVW)'}, {id: '2', label: 'Tally 2 (PGM)'}, {id: '3', label: 'Tally 3'}, {id: '4', label: 'Tally 4'}, {id: 'off', label: 'Off'} ] }
		]
	},
	{ outputTypeId: '276a8dcc', fields: [ //TSL 3.1 TCP
			{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'number' },
			{ fieldName: 'address', fieldLabel: 'Address', fieldType: 'number' },
			{ fieldName: 'label', fieldLabel: 'Label', fieldType: 'text' },
			{ fieldName: 'tallynumber', fieldLabel: 'Tally Number', fieldType: 'dropdown', options: [ {id: '1', label: 'Tally 1 (PVW)'}, {id: '2', label: 'Tally 2 (PGM)'}, {id: '3', label: 'Tally 3'}, {id: '4', label: 'Tally 4'}, {id: 'off', label: 'Off'} ] }
		]
	},
	{ outputTypeId: 'ffe2b0b6', fields: [ //Outgoing Webhook
			{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'number' },
			{ fieldName: 'path', fieldLabel: 'Path', fieldType: 'text' },
			{ fieldName: 'method', fieldLabel: 'Method', fieldType: 'dropdown', options: [ { id: 'GET', label: 'GET' }, { id: 'POST', label: 'POST'} ] },
			{ fieldName: 'postdata', fieldLabel: 'POST Data', fieldType: 'text' }
		]
	},
	{ outputTypeId: '6dbb7bf7', fields: [ //Local Console Output
			{ fieldName: 'text', fieldLabel: 'Text', fieldType: 'text'}
		]
	}
];

if (isPi()) {
	//adds the GPIO output type option if the software is running on a Raspberry Pi
	let outputTypeObj = {};
	outputTypeObj.id = '73815fc2';
	outputTypeObj.label = 'Local GPIO';
	outputTypeObj.type = 'gpio';
	outputTypeObj.enabled = false;
	output_types.push(outputTypeObj);

	let outputTypeDataFieldObj = {};
	outputTypeDataFieldObj.outputTypeId = outputTypeObj.id;
	let fields = [
		{ fieldName: 'pins', fieldLabel: 'GPIO Pins', fieldType: 'text' }
	];
	outputTypeDataFieldObj.fields = fields;
	output_types_datafields.push(outputTypeDataFieldObj);
}

const bus_options = [ // the busses available to monitor in Tally Arbiter
	{ id: 'e393251c', label: 'Preview', type: 'preview'},
	{ id: '334e4eda', label: 'Program', type: 'program'},
	{ id: '12c8d698', label: 'Preview + Program', type: 'previewprogram'}
]

var sources 			= []; // the configured tally sources
var devices 			= []; // the configured tally devices
var device_sources		= []; // the configured tally device-source mappings
var device_actions		= []; // the configured device output actions
var device_states		= []; // array of tally data as it has come in and the known state
var source_connections	= []; // array of source connections/servers as they are established

function uuidv4() //unique UUID generator for IDs
{
	return 'xxxxxxxx'.replace(/[xy]/g, function(c) {
		let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

function startUp() {
	loadConfig();
	initialSetup();
	DeleteInactiveClients();

	process.on('uncaughtException', function (err) {
		logger(`Caught exception: ${err}`, 'error');
	});
}

//sets up the REST API and GUI pages and starts the Express server that will listen for incoming requests
function initialSetup() {
	app.use(bodyParser.json({ type: 'application/json' }));

	//about the author, this program, etc.
	app.get('/', function (req, res) {
		res.sendFile('views/index.html', { root: __dirname });
	});

	//settings page - add sources, devices, actions, etc.
	app.get('/settings', function (req, res) {
		res.sendFile('views/settings.html', { root: __dirname });
	});

	//tally page - view tally state of any device
	app.get('/tally', function (req, res) {
		res.sendFile('views/tally.html', { root: __dirname });
	});

	app.get('/source_types', function (req, res) {
		//gets all Tally Source Types
		res.send(source_types);
	});

	app.get('/source_types_datafields', function (req, res) {
		//gets all Tally Source Types Data Fields
		res.send(source_types_datafields);
	});

	app.get('/output_types', function (req, res) {
		//gets all Tally Output Types
		res.send(output_types);
	});

	app.get('/output_types_datafields', function (req, res) {
		//gets all Tally Output Types Data Fields
		res.send(output_types_datafields);
	});

	app.get('/bus_options', function (req, res) {
		//gets all Tally Bus Options
		res.send(bus_options);
	});

	app.get('/sources', function (req, res) {
		//gets all Tally Sources
		res.send(sources);
	});

	app.get('/devices', function (req, res) {
		//gets all Tally Devices
		res.send(devices);
	});

	app.get('/device_sources', function (req, res) {
		//gets all Tally Device Sources
		res.send(device_sources);
	});

	app.get('/device_actions', function (req, res) {
		//gets all Tally Device Actions
		res.send(device_actions);
	});

	app.get('/device_states', function (req, res) {
		//gets all Tally Device States
		res.send(device_states);
	});

	app.get('/clients', function (req, res) {
		//gets all Listener Clients
		res.send(Clients);
	});

	app.get('/flash/:clientid', function (req, res) {
		//sends a flash command to the listener
		let clientId = req.params.clientid;
		let result = FlashClient(clientId);
		res.send(result);
	});

	app.get('/version', function (req, res) {
		//gets the version of the software
		res.send(version);
	});

	app.post('/manage', function (req, res) {
		//adds the item based on the type defined in the object
		let obj = req.body;
		
		let result = TallyArbiter_Manage(obj);
		res.send(result);
	});

	//serve up any files in the static folder like images, CSS, client-side JS, etc.
	app.use(express.static(path.join(__dirname, 'views/static')));

	//serve up jQuery from the Node module
	app.use('/js/jquery', express.static(path.join(__dirname, 'node_modules/jquery/dist')));

	app.use(function (req, res) {
		res.status(404).send({error: true, url: req.originalUrl + ' not found.'});
	});

	io.sockets.on('connection', function(socket) {

		socket.on('devices', function() { // sends the configured Devices to the socket
			socket.emit('devices', devices);
		});

		socket.on('bus_options', function() { // sends the Bus Options (preview, program) to the socket
			socket.emit('bus_options', bus_options);
		});

		socket.on('device_listen', function(deviceId, listenerType) { // emitted by a socket (tally page) that has selected a Device to listen for state information
			let device = GetDeviceByDeviceId(deviceId);
			if ((deviceId === 'null') || (!device)) {
				deviceId = devices[0].id;
			}

			socket.join('device-' + deviceId);
			let deviceName = GetDeviceByDeviceId(deviceId).name;
			logger(`Listener Client Connected. Type: ${listenerType} Device: ${deviceName}`, 'info');
			
			let ipAddress = socket.request.connection.remoteAddress;
			let datetimeConnected = new Date().getTime();
			
			let clientId = AddClient(socket.id, deviceId, listenerType, ipAddress, datetimeConnected);
			socket.emit('device_states', GetDeviceStatesByDeviceId(deviceId));
		});

		socket.on('device_listen_python', function(obj) { // emitted by the Python client that has selected a Device to listen for state information
			let deviceId = obj.deviceId;
			let device = GetDeviceByDeviceId(deviceId);
			if ((deviceId === 'null') || (!device)) {
				deviceId = devices[0].id;
			}

			let listenerType = 'python';

			socket.join('device-' + deviceId);
			let deviceName = GetDeviceByDeviceId(deviceId).name;
			logger(`Listener Client Connected. Type: ${listenerType} Device: ${deviceName}`, 'info');
			
			let ipAddress = socket.request.connection.remoteAddress;
			let datetimeConnected = new Date().getTime();
			
			let clientId = AddClient(socket.id, deviceId, listenerType, ipAddress, datetimeConnected);
			socket.emit('device_states', GetDeviceStatesByDeviceId(deviceId));
		});

		socket.on('device_listen_relay', function(relayGroupId, deviceId) { // emitted by the Relay Controller accessory program that has selected a Device to listen for state information
			let device = GetDeviceByDeviceId(deviceId);
			if (!device) {
				deviceId = devices[0].id;
			}

			let listenerType = 'relay';

			socket.join('device-' + deviceId);
			let deviceName = GetDeviceByDeviceId(deviceId).name;
			logger(`Listener Client Connected. Type: ${listenerType} Device: ${deviceName}`, 'info');
			
			let ipAddress = socket.request.connection.remoteAddress;
			let datetimeConnected = new Date().getTime();
			
			let clientId = AddClient(socket.id, deviceId, listenerType, ipAddress, datetimeConnected);
			//add relayGroupId to client
			for (let i = 0; i < Clients.length; i++) {
				if (Clients[i].id === clientId) {
					Clients[i].relayGroupId = relayGroupId;
					break;
				}
			}
			socket.emit('listener_relay_assignment', relayGroupId, deviceId);
		});

		socket.on('device_states', function(deviceId) {
			socket.emit('device_states', GetDeviceStatesByDeviceId(deviceId));
		});

		socket.on('settings', function () {
			socket.join('settings');
			socket.emit('clients', Clients);
			socket.emit('logs', Logs);
		});

		socket.on('flash', function(clientId) {
			for (let i = 0; i < Clients.length; i++) {
				if (Clients[i].id === clientId) {
					if (Clients[i].relayGroupId) {
						io.to(Clients[i].socketId).emit('flash', Clients[i].relayGroupId);
					}
					else {
						io.to(Clients[i].socketId).emit('flash');
					}
					break;
				}
			}
		});

		socket.on('reassign', function(clientId, oldDeviceId, deviceId) {
			for (let i = 0; i < Clients.length; i++) {
				if (Clients[i].id === clientId) {
					if (Clients[i].relayGroupId) {
						io.to(Clients[i].socketId).emit('reassign', Clients[i].relayGroupId, oldDeviceId, deviceId);
					}
					else {
						io.to(Clients[i].socketId).emit('reassign', oldDeviceId, deviceId);
					}
					break;
				}
			}
		});

		socket.on('listener_reassign', function(oldDeviceId, deviceId) {
			socket.leave('device-' + oldDeviceId);
			socket.join('device-' + deviceId);

			for (let i = 0; i < Clients.length; i++) {
				if (Clients[i].socketId === socket.id) {
					Clients[i].deviceId = deviceId;
					Clients[i].inactive = false;
					break;
				}
			}

			let oldDeviceName = GetDeviceByDeviceId(oldDeviceId).name;
			let deviceName = GetDeviceByDeviceId(deviceId).name;

			logger(`Listener Client reassigned from ${oldDeviceName} to ${deviceName}`, 'info');
			io.to('settings').emit('clients', Clients);
			socket.emit('device_states', GetDeviceStatesByDeviceId(deviceId));
		});

		socket.on('listener_reassign_relay', function(relayGroupId, oldDeviceId, deviceId) {
			let canRemove = true;
			for (let i = 0; i < Clients.length; i++) {
				if (Clients[i].socketId === socket.id) {
					if (Clients[i].deviceId === oldDeviceId) {
						if (Clients[i].relayGroupId !== relayGroupId) {
							canRemove = false;
							break;
						}
					}
				}
			}
			if (canRemove) {
				//no other relay groups on this socket are using the old device ID, so we can safely leave that room
				socket.leave('device-' + oldDeviceId);
			}
			
			socket.join('device-' + deviceId);

			for (let i = 0; i < Clients.length; i++) {
				if (Clients[i].relayGroupId === relayGroupId) {
					Clients[i].deviceId = deviceId;
				}
			}

			let oldDeviceName = GetDeviceByDeviceId(oldDeviceId).name;
			let deviceName = GetDeviceByDeviceId(deviceId).name;

			logger(`Listener Client reassigned from ${oldDeviceName} to ${deviceName}`, 'info');
			io.to('settings').emit('clients', Clients);
		});

		socket.on('listener_delete', function(clientId) { // emitted by the Settings page when an inactive client is being removed manually
			for (let i = Clients.length - 1; i >= 0; i--) {
				if (Clients[i].id === clientId) {
					logger(`Inactive Client removed: ${Clients[i].id}`, 'info');
					Clients.splice(i, 1);
				}
			}
			io.to('settings').emit('clients', Clients);
		});

		socket.on('disconnect', function() { // emitted when any listener client disconnects from the server
			DeactivateClient(socket.id);
		});
	});
	
	httpServer.listen(listenPort, function () { // start up http server
		logger(`Tally Arbiter running on port ${listenPort}`, 'info');
	});
}

function logger(log, type) { //logs the item to the console, to the log array, and sends the log item to the settings page

	let dtNow = new Date();

	switch(type) {
		case 'info':
			console.log(clc.black(`[${dtNow}]`) + '     ' + clc.blue(log));
			break;
		case 'error':
			console.log(clc.black(`[${dtNow}]`) + '     ' + clc.red.bold(log));
			break;
		case 'console_action':
			console.log(clc.black(`[${dtNow}]`) + '     ' + clc.green(log.text));
			break;
		default:
			console.log(clc.black(`[${dtNow}]`) + '     ' + util.inspect(log, {depth: null}));
			break;
	}
	
	let logObj = {};
	logObj.datetime = dtNow;
	logObj.log = log;
	logObj.type = type;
	Logs.push(logObj);

	io.to('settings').emit('log_item', logObj);
}

function loadConfig() { // loads the JSON data from the config file to memory
	try {
		let rawdata = fs.readFileSync(config_file);
		let configJson = JSON.parse(rawdata); 

		if (configJson.sources) {
			sources = configJson.sources;
			logger('Tally Arbiter Sources loaded.', 'info');
		}
		else {
			sources = [];
			logger('Tally Arbiter Sources could not be loaded.', 'error');
		}
		
		if (configJson.devices) {
			devices = configJson.devices;
			logger('Tally Arbiter Devices loaded.', 'info');
		}
		else {
			devices = [];
			logger('Tally Arbiter Devices could not be loaded.', 'error');
		}
		
		if (configJson.device_sources) {
			device_sources = configJson.device_sources;
			logger('Tally Arbiter Device Sources loaded.', 'info');
		}
		else {
			device_sources = [];
			logger('Tally Arbiter Device Sources could not be loaded.', 'error');
		}

		if (configJson.device_actions) {
			device_actions = configJson.device_actions;
			logger('Tally Arbiter Device Actions loaded.', 'info');
		}
		else {
			device_actions = [];
			logger('Tally Arbiter Device Actions could not be loaded.', 'error');
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

	for (let i = 0; i < sources.length; i++) {
		if (sources[i].enabled) {
			let sourceType = source_types.find( ({ id }) => id === sources[i].sourceTypeId);

			switch(sourceType.type) {
				case 'tsl_31_udp':
					SetUpTSLServer_UDP(sources[i].id);
					break;
				case 'tsl_31_tcp':
					SetUpTSLServer_TCP(sources[i].id);
					break;
				case 'atem':
					SetUpATEMServer(sources[i].id);
					break;
				case 'obs':
					SetUpOBSServer(sources[i].id);
					break;
				case 'vmix':
					SetUpVMixServer(sources[i].id);
					break;
				case 'roland':
					SetUpRolandSmartTally(sources[i].id);
					break;
				default:
					logger(`Error initiating connection for Source: ${sources[i].name}. The specified Source Type is not implemented at this time: ${sourceType.type}`, 'error');
					break;
			}
		}
	}

	initializeDeviceStates();
}

function initializeDeviceStates() { // initializes each device state in the array upon server startup
	let busId_preview = null;
	let busId_program = null;
	let busId_previewprogram = null;

	for (let i = 0; i < bus_options.length; i++) {
		switch(bus_options[i].type) {
			case 'preview':
				busId_preview = bus_options[i].id;
				break;
			case 'program':
				busId_program = bus_options[i].id;
				break;
			case 'previewprogram':
				busId_previewprogram = bus_options[i].id;
			default:
				break;
		}
	}

	for (let i = 0; i < devices.length; i++) {
		let deviceStateObj_preview = {};
		deviceStateObj_preview.deviceId = devices[i].id;
		deviceStateObj_preview.busId = busId_preview;
		deviceStateObj_preview.sources = [];
		device_states.push(deviceStateObj_preview);

		let deviceStateObj_program = {};
		deviceStateObj_program.deviceId = devices[i].id;
		deviceStateObj_program.busId = busId_program;
		deviceStateObj_program.sources = [];
		device_states.push(deviceStateObj_program);

		let deviceStateObj_previewprogram = {};
		deviceStateObj_previewprogram.deviceId = devices[i].id;
		deviceStateObj_previewprogram.busId = busId_previewprogram;
		deviceStateObj_previewprogram.sources = [];
		device_states.push(deviceStateObj_previewprogram);
	}
}

function SetUpTSLServer_UDP(sourceId)
{
	let source = sources.find( ({ id }) => id === sourceId);
	let port = source.data.port;

	try
	{
		let sourceConnectionObj = {};
		sourceConnectionObj.sourceId = sourceId;
		sourceConnectionObj.server = null;
		source_connections.push(sourceConnectionObj);

		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				source_connections[i].server = new TSLUMD(port);

				source_connections[i].server.on('message', function (tally) {
					processTSLTally(sourceId, tally);
				});
		
				logger(`Source: ${source.name}  TSL 3.1 Server started. Listening for data on UDP Port: ${port}`, 'info');
				for (let j = 0; j < sources.length; j++) {
					if (sources[j].id === sourceId) {
						sources[j].connected = true;
						break;
					}
				}
				break;
			}
		}
	} catch (error)
	{
		logger(`Error initiating connection for Source: ${source.name}. TSL 3.1 UDP Server Error occurred: ${error}`, 'error');
	}
}

function StopTSLServer_UDP(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);

	try
	{
		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				source_connections[i].server.server.close();
				logger(`Connection closed for Source: ${source.name}. TSL 3.1 UDP Server Stopped.`, 'info');
				for (let j = 0; j < sources.length; j++) {
					if (sources[j].id === sourceId) {
						sources[j].connected = false;
						break;
					}
				}
				break;
			}
		}
	}
	catch (error) {
		logger(`Error stopping connection for Source: ${source.name}. TSL 3.1 UDP Server Error occurred: ${error}`, 'error');
	}
}

function SetUpTSLServer_TCP(sourceId)
{
	let source = sources.find( ({ id }) => id === sourceId);
	let port = source.data.port;

	try
	{
		let parser = packet.createParser();
		parser.packet('tsl', 'b8{x1, b7 => address},b8{x2, b2 => brightness, b1 => tally4, b1 => tally3, b1 => tally2, b1 => tally1 }, b8[16] => label');

		let sourceConnectionObj = {};
		sourceConnectionObj.sourceId = sourceId;
		sourceConnectionObj.server = null;
		source_connections.push(sourceConnectionObj);

		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				source_connections[i].server = net.createServer(function (socket) {
					// Handle incoming messages
					socket.on('data', function (data) {
						parser.extract('tsl', function (result) {
							result.label = new Buffer(result.label).toString();
							processTSLTally(sourceId, result);
						});
						parser.parse(data);
					});

					socket.on('close', function () {
						logger(`Source: ${source.name}  TSL 3.1 Server connection closed.`, 'info');
					});

				}).listen(port);

				logger(`Source: ${source.name}  TSL 3.1 Server started. Listening for data on TCP Port: ${port}`, 'info');
				for (let j = 0; j < sources.length; j++) {
					if (sources[j].id === sourceId) {
						sources[j].connected = true;
						break;
					}
				}
				break;
			}
		}
	}
	catch (error) {
		logger(`Error initiating connection for Source: ${source.name}. TSL 3.1 TCP Server Error occurred: ${error}`, 'error');
	}
}

function StopTSLServer_TCP(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);

	try
	{	
		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				source_connections[i].server.close(function() {});
				logger(`Connection closed for Source: ${source.name}. TSL 3.1 TCP Server Stopped.`, 'info');
				for (let j = 0; j < sources.length; j++) {
					if (sources[j].id === sourceId) {
						sources[j].connected = false;
						break;
					}
				}
				break;
			}
		}
	}
	catch (error) {
		logger(`Error stopping connection for Source: ${source.name}. TSL 3.1 UDP Server Error occurred: ${error}`, 'error');
	}
}

function SetUpATEMServer(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);

	try {
		let atemIP = source.data.ip;
		let atemPort = 9910;

		let sourceConnectionObj = {};
		sourceConnectionObj.sourceId = sourceId;
		sourceConnectionObj.server = null;
		source_connections.push(sourceConnectionObj);

		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				source_connections[i].server = new ATEM();
				source_connections[i].server.ip = atemIP;
				source_connections[i].server.connect();

				source_connections[i].server.on('connectionStateChange', function (state) {
					switch (state.toString())
					{
						case 'closed':
							for (let j = 0; j < sources.length; j++) {
								if (sources[j].id === sourceId) {
									sources[j].connected = false;
									break;
								}
							}
							logger(`Connection closed for Source: ${source.name} (ATEM)`, 'info');
							io.to('settings').emit('sources', sources);
							break;
						case 'attempting':
							logger(`Initiating connection to Source: ${source.name}  ATEM: ${source.data.ip}`, 'info');
							break;
						case 'establishing':
							break;
						case 'open':
							for (let j = 0; j < sources.length; j++) {
								if (sources[j].id === sourceId) {
									sources[j].connected = true;
									break;
								}
							}
							logger(`Connection opened for Source: ${source.name} (ATEM)`, 'info');
							io.to('settings').emit('sources', sources);
							break;
						default:
							break;
					}
				});

				source_connections[i].server.on('connectionLost', function () {
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = false;
							break;
						}
					}
				});

				source_connections[i].server.on('sourceConfiguration', function (id, config, info) {
					
				});

				source_connections[i].server.on('sourceTally', function (sourceNumber, tallyState) {
					//build an object like the TSL module creates so we can use the same function to process it
					let tallyObj = {};
					tallyObj.address = sourceNumber;
					tallyObj.brightness = 1;
					tallyObj.tally1 = (tallyState.preview ? 1 : 0);
					tallyObj.tally2 = (tallyState.program ? 1 : 0);
					tallyObj.tally3 = 0;
					tallyObj.tally4 = 0;
					tallyObj.label = `Source ${sourceNumber}`;
					processTSLTally(sourceId, tallyObj);
				});

				break;
			}
		}
	}
	catch (error) {

	}
}

function StopATEMServer(sourceId) {
	let source = GetSourceBySourceId(sourceId);

	for (let i = 0; i < source_connections.length; i++) {
		if (source_connections[i].sourceId === sourceId) {
			source_connections[i].server.disconnect(null);
			logger(`ATEM connection closed for Source: ${source.name}`, 'info');
			break;
		}
	}
}

function SetUpOBSServer(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);

	try
	{
		let ip = source.data.ip;
		let port = source.data.port;
		let password = source.data.password;
	
		let sourceConnectionObj = {};
		sourceConnectionObj.sourceId = sourceId;
		sourceConnectionObj.server = null;
		source_connections.push(sourceConnectionObj);

		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				source_connections[i].server = new OBS();
				source_connections[i].server.ip = ip;
				source_connections[i].server.connect({address: ip + ':' + port, password: password}, function (data) {
					logger(`Connected to OBS Studio @ ${ip}:${port}`, 'info');
				});

				source_connections[i].server.on('error', err => {
					logger('OBS socket error: ' + err, 'error');
				});

				source_connections[i].server.on('ConnectionOpened', function (data) {
					logger('OBS Connection Opened.', 'info');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = true;
							break;
						}
					}
					io.to('settings').emit('sources', sources);
				});

				source_connections[i].server.on('ConnectionClosed', function (data) {
					logger(`Connection closed for Source: ${source.name} (OBS Studio)`, 'info');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = false;
							break;
						}
					}
					io.to('settings').emit('sources', sources);
				});

				source_connections[i].server.on('AuthenticationSuccess', function (data) {
					logger('OBS Authenticated.', 'info');
				});

				source_connections[i].server.on('AuthenticationFailure', function (data) {
					logger('Invalid OBS Password.', 'info');
				});

				source_connections[i].server.on('PreviewSceneChanged', function (data) {
					if (data)
					{
						if (data.sources)
						{
							processOBSTally(sourceId, data.sources, 'preview');
						}
					}
				});

				source_connections[i].server.on('SwitchScenes', function (data) {
					if (data)
					{
						if (data.sources)
						{
							processOBSTally(sourceId, data.sources, 'program');
						}
					}
				});

				break;
			}
		}
	}
	catch (error) {
		logger(`OBS Error: ${error}`, 'error');
	}
}

function processOBSTally(sourceId, sourceArray, tallyType) {
	let device_sources_specific = GetDeviceSourcesBySourceId(sourceId);

	for (let i = 0; i < sourceArray.length; i++) {
		let tallyObj = {};
		tallyObj.label = sourceArray[i].name;
		tallyObj.address = sourceArray[i].name;
		tallyObj.tally4 = 0;
		tallyObj.tally3 = 0;
		tallyObj.tally2 = 0; //PGM
		tallyObj.tally1 = 0; //PVW

		switch(tallyType) {
			case 'preview':
				tallyObj.tally1 = ((sourceArray[i].render) ? 1 : 0);
				break;
			case 'program':
				tallyObj.tally2 = ((sourceArray[i].render) ? 1 : 0);
				break;
			default:
				break;
		}
		processTSLTally(sourceId, tallyObj);
	}

	for (let i = 0; i < device_sources_specific.length; i++) {
		let device_source_found = false;
		for (j = 0; j < sourceArray.length; j++) {
			if (device_sources_specific[i].address === sourceArray[j].name) {
				device_source_found = true;
				break;
			}
		}
		if (!device_source_found) {
			let inPreview = false;
			let inProgram = false;

			for (j = 0; j < device_states.length; j++) {
				if (device_states[j].sources.includes(device_sources_specific[i].sourceId)) {
					if (GetBusByBusId(device_states[j].busId).type === 'preview') {
						inPreview = true;
					}
					else if (GetBusByBusId(device_states[j].busId).type === 'preview') {
						inProgram = true;
					}
				}
			}

			tallyObj = {};
			tallyObj.label = device_sources_specific[i].address;
			tallyObj.address = device_sources_specific[i].address;
			tallyObj.tally4 = 0;
			tallyObj.tally3 = 0;
			tallyObj.tally2 = 0; //PGM
			tallyObj.tally1 = 0; //PVW

			switch(tallyType) {
				case 'preview':
					if (inProgram) {
						tallyObj.tally2 = 1;
					}
					tallyObj.tally1 = 0;
					break;
				case 'program':
					if (inPreview) {
						tallyObj.tally1 = 1;
					}
					tallyObj.tally2 = 0;
					break;
				default:
					break;
			}
			processTSLTally(sourceId, tallyObj);
		}
	}
}

function StopOBSServer(sourceId) {
	let source = GetSourceBySourceId(sourceId);
	
	for (let i = 0; i < source_connections.length; i++) {
		if (source_connections[i].sourceId === sourceId) {
			source_connections[i].server.disconnect();
			break;
		}
	}
}

function SetUpVMixServer(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);
	let ip = source.data.ip;
	let port = 8099;

	try
	{
		let sourceConnectionObj = {};
		sourceConnectionObj.sourceId = sourceId;
		sourceConnectionObj.server = null;
		source_connections.push(sourceConnectionObj);

		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				source_connections[i].server = new net.Socket();
				source_connections[i].server.connect(port, ip, function() {
					logger(`Source: ${source.name}  VMix TCP Client Opened.`, 'info');
					source_connections[i].server.write('SUBSCRIBE TALLY\r\n');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = true;
							break;
						}
					}
					io.to('settings').emit('sources', sources);
				});

				source_connections[i].server.on('data', function (data) {
					data = data
					.toString()
					.split(/\r?\n/);

					tallyData = data.filter(text => text.startsWith('TALLY OK'));

					if (tallyData.length > 0) {
						for (let j = 9; j < tallyData[0].length; j++) {
							let address = j-9+1;
							let value = tallyData[0].charAt(j);

							//build an object like the TSL module creates so we can use the same function to process it
							let tallyObj = {};
							tallyObj.address = address.toString();
							tallyObj.brightness = 1;
							tallyObj.tally1 = ((value === '2') ? 1 : 0);
							tallyObj.tally2 = ((value === '1') ? 1 : 0);
							tallyObj.tally3 = 0;
							tallyObj.tally4 = 0;
							tallyObj.label = `Input ${address}`;
							processTSLTally(sourceId, tallyObj);
						}
					}
				});

				source_connections[i].server.on('close', function () {
					logger(`Source: ${source.name}  VMix TCP Client Closed.`, 'info');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = false;
							break;
						}
					}
					io.to('settings').emit('sources', sources);
				});
				break;
			}
		}
	}
	catch (error) {
		logger(`Error initiating connection for Source: ${source.name}. VMix Error Occurred: ${error}`, 'error');
	}
}

function StopVMixServer(sourceId) {
	let source = GetSourceBySourceId(sourceId);
	
	for (let i = 0; i < source_connections.length; i++) {
		if (source_connections[i].sourceId === sourceId) {
			source_connections[i].server.write('QUIT\r\n');
			break;
		}
	}
}

function SetUpRolandSmartTally(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);
	let ip = source.data.ip;
	let port = 80;

	try {
		let sourceConnectionObj = {};
		sourceConnectionObj.sourceId = sourceId;
		sourceConnectionObj.server = null;
		source_connections.push(sourceConnectionObj);

		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				source_connections[i].server = setInterval(function() {
					for (let j = 0; j < device_sources.length; j++) {
						if (device_sources[j].sourceId === sourceId) {
							let address = device_sources[j].address;
							axios.get(`http://${ip}/tally/${address}/status`)
							.then(function (response) {
								let tallyObj = {};
								tallyObj.address = address;
								tallyObj.label = "Input " + address;
								tallyObj.tally4 = 0;
								tallyObj.tally3 = 0;
								tallyObj.tally2 = 0;
								tallyObj.tally1 = 0;
								
								switch(response)
								{
									case "onair":
										tallyObj.tally2 = 1;
										tallyObj.tally1 = 0;
										break;
									case "selected":
										tallyObj.tally2 = 0;
										tallyObj.tally1 = 1;
										break;
									case "unselected":
									default:
										tallyObj.tally2 = 0;
										tallyObj.tally1 = 0;
										break;
								}
								processTSLTally(sourceId, tallyObj);							
							})
							.catch(function (error) {
								logger(`An error occured fetching the Roland Smart Tally data: ${error}`, 'error');
							});
						}
					}
				}, 1000, sourceId);
				break;
			}
		}
	}
	catch (error) {
		logger(`Error initiating connection for Source: ${source.name}. Roland Smart Tally Error Occurred: ${error}`, 'error');
	}
}

function StopRolandSmartTally(sourceId) {
	let source = GetSourceBySourceId(sourceId);
	
	for (let i = 0; i < source_connections.length; i++) {
		if (source_connections[i].sourceId === sourceId) {
			clearInterval(source_connections[i].server);
			logger(`Roland Smart Tally connection closed for Source: ${source.name}`, 'info');
			break;
		}
	}
}

function processTSLTally(sourceId, tallyObj) // Processes the TSL Data
{
	let deviceId = null;

	for (let i = 0; i < device_sources.length; i++) {
		if ((device_sources[i].sourceId === sourceId) && (device_sources[i].address === tallyObj.address.toString())) {
			deviceId = device_sources[i].deviceId;
			break;
		}
	}

	let busId_preview = null;
	let busId_program = null;
	let busId_previewprogram = null;

	for (let i = 0; i < bus_options.length; i++) {
		switch(bus_options[i].type) {
			case 'preview':
				busId_preview = bus_options[i].id;
				break;
			case 'program':
				busId_program = bus_options[i].id;
				break;
			case 'previewprogram':
				busId_previewprogram = bus_options[i].id;
				break;
			default:
				break;
		}
	}

	if (deviceId !== null) {
		//do something with the device given the current state

		let inPreview = false;
		let inProgram = false;

		for (let i = 0; i < device_states.length; i++) {
			if (device_states[i].deviceId === deviceId) {
				if (device_states[i].busId === busId_preview) {
					if (device_states[i].sources.includes(sourceId)) {
						//if the device is currently marked as in preview, let's check and see if we should remove it
						if (!tallyObj.tally1) {
							//remove it, it's no longer in preview on that source
							device_states[i].sources.splice(device_states[i].sources.indexOf(sourceId));
							inPreview = false;
						}
						else {
							inPreview = true;
						}
					}
					else {
						//if the device is currently not marked as in preview, let's check and see if we should include it
						if (tallyObj.tally1) {
							//add it, it's not already in preview on this source
							device_states[i].sources.push(sourceId);
							inPreview = true;
						}
					}
				}

				if (device_states[i].busId === busId_program) {
					if (device_states[i].sources.includes(sourceId)) {
						//if the device is currently marked as in program, let's check and see if we should remove it
						if (!tallyObj.tally2) {
							//remove it, it's no longer in program on that source
							device_states[i].sources.splice(device_states[i].sources.indexOf(sourceId));
							inProgram = false;
						}
						else {
							inProgram = true;
						}
					}
					else {
						//if the device is currently not marked as in program, let's check and see if we should include it
						if (tallyObj.tally2) {
							//add it, it's not already in program on this source
							device_states[i].sources.push(sourceId);
							inProgram = true;
						}
					}
				}
			}
		}

		for (let i = 0; i < device_states.length; i++) {
			if (device_states[i].deviceId === deviceId) {
				if (device_states[i].busId === busId_previewprogram) {
					if (device_states[i].sources.includes(sourceId)) {
						//if the device is currently marked as in preview+program, let's check and see if we should remove it
						if ((!inPreview) && (!inProgram)) {
							//remove it, it's no longer in preview+program on that source
							device_states[i].sources.splice(device_states[i].sources.indexOf(sourceId));
						}
					}
					else {
						//if the device is currently not marked as in preview, let's check and see if we should include it
						if ((inPreview) && (inProgram)) {
							//add it, it's not already in preview on this source
							device_states[i].sources.push(sourceId);
						}
					}
				}
			}
		}

		UpdateDeviceState(deviceId);
		io.to('settings').emit('device_states', device_states);
	}
}

function UpdateDeviceState(deviceId) {
	let busId_preview = null;
	let busId_program = null;
	let busId_previewprogram = null;

	for (let i = 0; i < bus_options.length; i++) {
		switch(bus_options[i].type) {
			case 'preview':
				busId_preview = bus_options[i].id;
				break;
			case 'program':
				busId_program = bus_options[i].id;
				break;
			case 'previewprogram':
				busId_previewprogram = bus_options[i].id;
				break;
			default:
				break;
		}
	}

	let inPreview = null;
	let inProgram = null;

	for (let i = 0; i < device_states.length; i++) {
		if (device_states[i].deviceId === deviceId) {
			if (device_states[i].busId === busId_preview) {
				if ((device_states[i].sources.length > 0) && (!device_states[i].active)) {
					//if the sources list is now greater than zero and the state is not already marked active for this device, run the action and make it active
					RunAction(deviceId, device_states[i].busId, true);
					device_states[i].active = true;
				}
				else if ((device_states[i].sources.length < 1) && (device_states[i].active)) {
					//if the source list is now zero and the state is marked active, run the action and make it inactive
					RunAction(deviceId, device_states[i].busId, false);
					device_states[i].active = false;
				}
			}
			else if (device_states[i].busId === busId_program) {
				if ((device_states[i].sources.length > 0) && (!device_states[i].active)) {
					//if the sources list is now greater than zero and the state is not already marked active for this device, run the action and make it active
					RunAction(deviceId, device_states[i].busId, true);
					device_states[i].active = true;
				}
				else if ((device_states[i].sources.length < 1) && (device_states[i].active)) {
					//if the source list is now zero and the state is marked active, run the action and make it inactive
					RunAction(deviceId, device_states[i].busId, false);
					device_states[i].active = false;
				}
			}
			else if (device_states[i].busId === busId_previewprogram) {
				if ((device_states[i].sources.length > 0) && (!device_states[i].active)) {
					//if the sources list is now greater than zero and the state is not already marked active for this device, run the action and make it active
					RunAction(deviceId, device_states[i].busId, true);
					device_states[i].active = true;
				}
				else if ((device_states[i].sources.length < 1) && (device_states[i].active)) {
					//if the source list is now zero and the state is marked active, run the action and make it inactive
					RunAction(deviceId, device_states[i].busId, false);
					device_states[i].active = false;
				}
			}
		}
	}
}

function RunAction(deviceId, busId, active) {
	let actionObj = null;

	let deviceObj = GetDeviceByDeviceId(deviceId);

	if (deviceObj.enabled === true) {
		logger(`Running Actions for Device: ${deviceObj.name}`, 'info');
		for (let i = 0; i < device_actions.length; i++) {
			if (device_actions[i].deviceId === deviceId) {
				if ((device_actions[i].busId === busId) && (device_actions[i].active === active)) {
					actionObj = device_actions[i];
					
					let outputType = output_types.find( ({ id }) => id === actionObj.outputTypeId);
	
					logger(`Running action: ${outputType.type}  ${device_actions[i].id}`, 'info');
	
					switch(outputType.type) {
						case 'tsl_31_udp':
							RunAction_TSL_31_UDP(actionObj.data);
							break;
						case 'tsl_31_tcp':
							RunAction_TSL_31_TCP(actionObj.data);
							break;
						case 'webhook':
							RunAction_Webhook(actionObj.data);
							break;
						case 'protally':
							RunAction_ProTally(actionObj.data);
							break;
						case 'gpio':
							logger(`Device Action: ${device_actions[i].id}  Error: GPIO output type not supported at this time.`, 'error');
							break;
						case 'console':
							logger(actionObj.data, 'console_action');
							break;
						default:
							logger(`Device Action: ${device_actions[i].id}  Error: Unsupported Output Type: ${outputType.type}`, 'error');
							break;
					}
				}
			}
		}
	}
	else {
		//the device is disabled, so don't run any actions against it
		logger(`Device: ${deviceObj.name} is not enabled, so no actions will be run.`, 'info');
	}
	
	logger(`Sending device states to listeners for Device: ${deviceObj.id}`, 'info');
	io.to('device-' + deviceId).emit('device_states', GetDeviceStatesByDeviceId(deviceId));
}

function RunAction_TSL_31_UDP(data) {
	try {
		let bufUMD = Buffer.alloc(18, 0); //ignores spec and pad with 0 for better aligning on Decimator etc
		bufUMD[0] = 0x80 + parseInt(data.address);
		bufUMD.write(data.label, 2);
	
		let bufTally = 0;
	
		if (data.tallynumber == '1') {
			bufTally = 0x31;
		}
		else if (data.tallynumber == '2') {
			bufTally = 0x32;
		}
		else if (data.tallynumber == '3') {
			bufTally = 0x34;
		}
		else if (data.tallynumber == '4') {
			bufTally = 0x38;
		}
		else {
			bufTally = 0x30;
		}
	
		bufUMD[1] = bufTally;
	
		let client = dgram.createSocket('udp4');
		client.on('message',function(msg,info){
		});
	
		client.send(bufUMD, data.port, data.ip, function(error) {
			if (!error) {
				logger(`TSL 3.1 UDP Data sent.`, 'info');
			}
			client.close();
		});
	}
	catch (error) {
		logger(`An error occured sending the TCP 3.1 UDP Message: ${error}`, 'error');
	}
}

function RunAction_TSL_31_TCP(data) {
	try {
		let bufUMD = Buffer.alloc(18, 0); //ignore spec and pad with 0 for better aligning on Decimator, etc.
		bufUMD[0] = 0x80 + parseInt(data.address); //Address + 0x80
		bufUMD.write(data.label, 2);
	
		let bufTally = 0;
	
		if (data.tallynumber == '1') {
			bufTally = 0x31;
		}
		else if (data.tallynumber == '2') {
			bufTally = 0x32;
		}
		else if (data.tallynumber == '3') {
			bufTally = 0x34;
		}
		else if (data.tallynumber == '4') {
			bufTally = 0x38;
		}
		else {
			bufTally = 0x30;
		}
	
		bufUMD[1] = bufTally;
	
		let client = new net.Socket();
		client.connect(data.port, data.ip, function() {
			client.write(bufUMD);
		});
	
		client.on('data', function(data) {
			client.destroy(); // kill client after server's response
		});
	
		client.on('close', function() {
		});
	}
	catch (error) {
		logger(`An error occured sending the TCP 3.1 TCP Message: ${error}`, 'error');
	}
}

function RunAction_Webhook(data) {
	try {
		let options = {
			method: data.method,
			url: 'http://' + data.ip + ':' + data.port + '/' + data.path
		};

		if (data.method === 'POST') {
			if (data.postdata !== '') {
				options.data = data.postdata;
			}
		}

		axios(options)
		.then(function (response) {
			logger(`Outgoing Webhook triggered.`, 'info');
		})
		.catch(function (error) {
			logger(`An error occured triggering the Outgoing Webhook: ${error}`, 'error');
		});
	}
	catch (error) {
		logger(`An error occured sending the Outgoing Webhook: ${error}`, 'error');
	}
}

function RunAction_ProTally(data) {
	try {
		let proTallyObj = {};

		proTallyObj.windowNumber = data.windowNumber;
		proTallyObj.mode = data.mode;
		proTallyObj.label = data.label;
		proTallyObj.color = data.color;
	
		let client = new net.Socket();
		client.connect(data.port, data.ip, function() {
			client.write(JSON.stringify(proTallyObj));
		});

		client.on('error', function(error) {
			logger(`An error occured sending the ProTally message: ${error}`, 'error');
			client.destroy();
		});
	
		client.on('data', function(data) {
			client.destroy(); // kill client after server's response
		});
	
		client.on('close', function() {
		});
	}
	catch (error) {
		logger(`An error occured sending the ProTally message: ${error}`, 'error');
	}
}
function TallyArbiter_Manage(obj) {
	switch(obj.type) {
		case 'source':
			if (obj.action === 'add') {
				result = TallyArbiter_Add_Source(obj);
			}
			else if (obj.action === 'edit') {
				result = TallyArbiter_Edit_Source(obj);
			}
			else if (obj.action === 'delete') {
				result = TallyArbiter_Delete_Source(obj);
			}
			break;
		case 'device':
			if (obj.action === 'add') {
				result = TallyArbiter_Add_Device(obj);
			}
			else if (obj.action === 'edit') {
				result = TallyArbiter_Edit_Device(obj);
			}
			else if (obj.action === 'delete') {
				result = TallyArbiter_Delete_Device(obj);
			}
			break;
		case 'device_source':
			if (obj.action === 'add') {
				result = TallyArbiter_Add_Device_Source(obj);
			}
			else if (obj.action === 'edit') {
				result = TallyArbiter_Edit_Device_Source(obj);
			}
			else if (obj.action === 'delete') {
				result = TallyArbiter_Delete_Device_Source(obj);
			}
			break;
		case 'device_action':
			if (obj.action === 'add') {
				result = TallyArbiter_Add_Device_Action(obj);
			}
			else if (obj.action === 'edit') {
				result = TallyArbiter_Edit_Device_Action(obj);
			}
			else if (obj.action === 'delete') {
				result = TallyArbiter_Delete_Device_Action(obj);
			}
			break;
		default:
			break;
	}

	try {
		let configJson = {
			sources: sources,
			devices: devices,
			device_sources: device_sources,
			device_actions: device_actions
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
	finally {
		//sends a result object back
		return result;
	}
}

function StartConnection(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);
	let sourceType = source_types.find( ({ id }) => id === source.sourceTypeId);

	switch(sourceType.type) {
		case 'tsl_31_udp':
			SetUpTSLServer_UDP(sourceId);
			break;
		case 'tsl_31_tcp':
			SetUpTSLServer_TCP(sourceId);
			break;
		case 'atem':
			SetUpATEMServer(sourceId);
			break;
		case 'obs':
			SetUpOBSServer(sourceId);
			break;
		case 'vmix':
			SetUpVMixServer(sourceId);
			break;
		case 'roland':
			SetUpRolandSmartTally(sourceId);
			break;
		default:
			break;
	}
}

function StopConnection(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);
	let sourceType = source_types.find( ({ id }) => id === source.sourceTypeId);

	switch(sourceType.type) {
		case 'tsl_31_udp':
			StopTSLServer_UDP(sourceId);
			break;
		case 'tsl_31_tcp':
			StopTSLServer_TCP(sourceId);
			break;
		case 'atem':
			StopATEMServer(sourceId);
			break;
		case 'obs':
			StopOBSServer(sourceId);
			break;
		case 'vmix':
			StopVMixServer(sourceId);
			break;
		case 'roland':
			StopRolandSmartTally(sourceId);
			break;
		default:
			break;
	}
}

function TallyArbiter_Add_Source(obj) {
	let sourceObj = obj.source;
	sourceObj.id = uuidv4();
	sources.push(sourceObj);

	logger(`Source Added: ${sourceObj.name}`, 'info');

	StartConnection(sourceObj.id);

	return {result: 'source-added-successfully'};
}

function TallyArbiter_Edit_Source(obj) {
	let sourceObj = obj.source;
	let sourceTypeId = null;
	let connected = false;

	for (let i = 0; i < sources.length; i++) {
		if (sources[i].id === sourceObj.id) {
			sources[i].name = sourceObj.name;
			sources[i].enabled = sourceObj.enabled;
			sources[i].data = sourceObj.data;
			sourceTypeId = sources[i].sourceTypeId;
			connected = sources[i].connected;
		}
	}

	logger(`Source Edited: ${sourceObj.name}`, 'info');

	if (sourceObj.enabled === true) {
		if (!connected) {
			StartConnection(sourceObj.id);
		}
	}
	else {
		StopConnection(sourceObj.id);
	}

	return {result: 'source-edited-successfully'};
}

function TallyArbiter_Delete_Source(obj) {
	let sourceId = obj.sourceId;
	let sourceName = null;

	for (let i = 0; i < sources.length; i++) {
		if (sources[i].id === sourceId) {
			if (sources[i].connected === true) {
				StopConnection(sourceId);
			}
			sourceName = sources[i].name;
			sources.splice(i, 1);
		}
	}

	for (let i = device_sources.length - 1; i >= 0; i--) {
		if (device_sources[i].sourceId === sourceId) {
			device_sources.splice(i, 1);
		}
	}

	for (let i = device_states.length - 1; i >=0; i--) {
		for (let j = device_states[i].sources.length - 1; j >=0; j--) {
			if (device_states[i].sources[j] === sourceId) {
				device_states[i].sources.splice(j, 1);
				break;
			}
		}
	}

	io.to('settings').emit('device_states', device_states);

	logger(`Source Deleted: ${sourceName}`, 'info');

	return {result: 'source-deleted-successfully'};
}

function TallyArbiter_Add_Device(obj) {
	let deviceObj = obj.device;
	deviceObj.id = uuidv4();
	devices.push(deviceObj);

	logger(`Device Added: ${deviceObj.name}`, 'info');

	return {result: 'device-added-successfully'};
}

function TallyArbiter_Edit_Device(obj) {
	let deviceObj = obj.device;
	for (let i = 0; i < devices.length; i++) {
		if (devices[i].id === deviceObj.id) {
			devices[i].name = deviceObj.name;
			devices[i].description = deviceObj.description;
			devices[i].enabled = deviceObj.enabled;
		}
	}

	logger(`Device Edited: ${deviceObj.name}`, 'info');

	return {result: 'device-edited-successfully'};
}

function TallyArbiter_Delete_Device(obj) {
	let deviceId = obj.deviceId;
	let deviceName = GetDeviceByDeviceId(deviceId).name;

	for (let i = 0; i < devices.length; i++) {
		if (devices[i].id === deviceId) {
			devices.splice(i, 1);
			break;
		}
	}

	for (let i = device_sources.length - 1; i >= 0; i--) {
		if (device_sources[i].deviceId === deviceId) {
			device_sources.splice(i, 1);
		}
	}
	
	for (let i = device_actions.length - 1; i >= 0; i--) {
		if (device_actions[i].deviceId === deviceId) {
			device_actions.splice(i, 1);
		}
	}

	logger(`Device Deleted: ${deviceName}`, 'info');

	return {result: 'device-deleted-successfully'};
}

function TallyArbiter_Add_Device_Source(obj) {
	let deviceSourceObj = obj.device_source;
	let deviceId = deviceSourceObj.deviceId;
	deviceSourceObj.id = uuidv4();
	device_sources.push(deviceSourceObj);

	let deviceName = GetDeviceByDeviceId(deviceSourceObj.deviceId).name;
	let sourceName = GetSourceBySourceId(deviceSourceObj.sourceId).name;

	logger(`Device Source Added: ${deviceName} - ${sourceName}`, 'info');

	return {result: 'device-source-added-successfully', deviceId: deviceId};
}

function TallyArbiter_Edit_Device_Source(obj) {
	let deviceSourceObj = obj.device_source;
	let deviceId = null;
	for (let i = 0; i < device_sources.length; i++) {
		if (device_sources[i].id === deviceSourceObj.id) {
			deviceId = device_sources[i].deviceId;
			device_sources[i].sourceId = deviceSourceObj.sourceId;
			device_sources[i].address = deviceSourceObj.address;
		}
	}

	let deviceName = GetDeviceByDeviceId(deviceSourceObj.deviceId).name;
	let sourceName = GetSourceBySourceId(deviceSourceObj.sourceId).name;

	logger(`Device Source Edited: ${deviceName} - ${sourceName}`, 'info');

	return {result: 'device-source-edited-successfully', deviceId: deviceId};
}

function TallyArbiter_Delete_Device_Source(obj) {
	let deviceSourceId = obj.device_source.id;
	let deviceId = null;
	let sourceId = null;

	for (let i = 0; i < device_sources.length; i++) {
		if (device_sources[i].id === deviceSourceId) {
			deviceId = device_sources[i].deviceId;
			sourceId = device_sources[i].sourceId;
			device_sources.splice(i, 1);
		}
	}

	let deviceName = GetDeviceByDeviceId(deviceId).name;
	let sourceName = GetSourceBySourceId(sourceId).name;

	logger(`Device Source Deleted: ${deviceName} - ${sourceName}`, 'info');

	return {result: 'device-source-deleted-successfully', deviceId: deviceId};
}

function TallyArbiter_Add_Device_Action(obj) {
	let deviceActionObj = obj.device_action;
	let deviceId = deviceActionObj.deviceId;
	deviceActionObj.id = uuidv4();
	device_actions.push(deviceActionObj);

	let deviceName = GetDeviceByDeviceId(deviceActionObj.deviceId).name;
	let outputTypeName = GetOutputTypeByOutputTypeId(deviceActionObj.outputTypeId).label;

	logger(`Device Action Added: ${deviceName} - ${outputTypeName}`, 'info');

	return {result: 'device-action-added-successfully', deviceId: deviceId};
}

function TallyArbiter_Edit_Device_Action(obj) {
	let deviceActionObj = obj.device_action;
	let deviceId = null;
	for (let i = 0; i < device_actions.length; i++) {
		if (device_actions[i].id === deviceActionObj.id) {
			deviceId = device_actions[i].deviceId;
			device_actions[i].busId = deviceActionObj.busId;
			device_actions[i].active = deviceActionObj.active;
			device_actions[i].outputTypeId = deviceActionObj.outputTypeId;
			device_actions[i].data = deviceActionObj.data;
		}
	}

	let deviceName = GetDeviceByDeviceId(deviceActionObj.deviceId).name;
	let outputTypeName = GetOutputTypeByOutputTypeId(deviceActionObj.outputTypeId).label;

	logger(`Device Action Edited: ${deviceName} - ${outputTypeName}`, 'info');

	return {result: 'device-action-edited-successfully', deviceId: deviceId};
}

function TallyArbiter_Delete_Device_Action(obj) {
	let deviceActionId = obj.device_action.id;
	let deviceId = null;
	let outputTypeId = null;

	for (let i = 0; i < device_actions.length; i++) {
		if (device_actions[i].id === deviceActionId) {
			deviceId = device_actions[i].deviceId;
			outputTypeId = device_actions[i].outputTypeId;
			device_actions.splice(i, 1);
		}
	}

	let deviceName = GetDeviceByDeviceId(deviceId).name;
	let outputTypeName = GetOutputTypeByOutputTypeId(outputTypeId).label;

	logger(`Device Action Deleted: ${deviceName} - ${outputTypeName}`, 'info');

	return {result: 'device-action-deleted-successfully', deviceId: deviceId};
}

function GetSourceBySourceId(sourceId) {
	//gets the Source object by id
	return sources.find( ({ id }) => id === sourceId);
}

function GetSourceTypeBySourceTypeId(sourceTypeId) {
	//gets the Source Type object by id
	return source_types.find( ({ id }) => id === sourceTypeId);
}

function GetBusByBusId(busId) {
	//gets the Bus object by id
	return bus_options.find( ({ id }) => id === busId);
}

function GetDeviceByDeviceId(deviceId) {
	//gets the Device object by id
	return devices.find( ({ id }) => id === deviceId);
}

function GetOutputTypeByOutputTypeId(outputTypeId) {
	//gets the Output Type object by id
	return output_types.find( ({ id }) => id === outputTypeId);
}

function GetDeviceSourcesBySourceId(sourceId) {
	return device_sources.filter(obj => obj.sourceId === sourceId);
}

function GetDeviceStatesByDeviceId(deviceId) {
	//gets the current tally data for the device and returns it

	return device_states.filter(obj => obj.deviceId === deviceId);
}

function AddClient(socketId, deviceId, listenerType, ipAddress, datetimeConnected) {
	let clientObj = {};

	clientObj.id = uuidv4();
	clientObj.socketId = socketId;
	clientObj.deviceId = deviceId;
	clientObj.listenerType = listenerType;
	clientObj.ipAddress = ipAddress;
	clientObj.datetime_connected = datetimeConnected;
	clientObj.inactive = false;
	
	Clients.push(clientObj);

	io.to('settings').emit('clients', Clients);

	return clientObj.id;
}

function DeactivateClient(socketId) {
	for (let i = 0; i < Clients.length; i++) {
		if (Clients[i].socketId === socketId) {
			//Clients.splice(i, 1);
			Clients[i].inactive = true;
			Clients[i].datetime_inactive = new Date().getTime();
		}
	}

	io.to('settings').emit('clients', Clients);
}

function DeleteInactiveClients() {
	let changesMade = false;
	for (let i = Clients.length - 1; i >= 0; i--) {
		if (Clients[i].inactive === true) {
			let dtNow = new Date().getTime();
			if ((dtNow - Clients[i].datetime_inactive) > (1000 * 60 * 60)) { //1 hour
				logger(`Inactive Client removed: ${Clients[i].socketId}`, 'info');
				Clients.splice(i, 1);
				changesMade = true;
			}
		}
	}

	if (changesMade) {
		io.to('settings').emit('clients', Clients);
	}

	setTimeout(DeleteInactiveClients, 5 * 1000); // runs every 5 minutes
}

function FlashClient(clientId) {
	let clientObj = Clients.find( ({ id }) => id === clientId);

	if (clientObj) {
		if (clientObj.relayGroupId) {
			io.to(clientObj.socketId).emit('flash', Clients[i].relayGroupId);
		}
		else {
			io.to(clientObj.socketId).emit('flash');
		}
		return {result: 'flash-sent-successfully', cliendId: clientId};
	}
	else {
		return {result: 'flash-not-sent', clientId: clientId, error: 'client id not found'};
	}
}

startUp();