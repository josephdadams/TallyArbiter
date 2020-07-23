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
const osc 			= require('osc');
const xml2js		= require('xml2js');

//Tally Arbiter variables
const listenPort 	= process.env.PORT || 4455;
const oscPort 		= 5958;
var oscUDP			= null;
const config_file 	= './config.json'; //local storage JSON file
var Clients 		= []; //array of connected listener clients (web, python, relay, etc.)
var Logs 			= []; //array of actions, information, and errors
var tallydata_OBS 	= []; //array of OBS sources and current tally data
var tallydata_TC 	= []; //array of Tricaster sources and current tally data
var PortsInUse		= []; //array of UDP/TCP ports in use, includes reserved ports
var tsl_clients		= []; //array of TSL 3.1 clients that Tally Arbiter will send tally data to
var cloud_destinations = []; //array of Tally Arbiter Cloud Destinations (host, port, key)

let portObj = {};
portObj.port = '9910'; //ATEM
portObj.sourceId = 'reserved';
PortsInUse.push(portObj);

portObj = {};
portObj.port = '8099'; //VMix
portObj.sourceId = 'reserved';
PortsInUse.push(portObj);

portObj = {};
portObj.port = oscPort.toString(); //OSC Broadcast
portObj.sourceId = 'reserved';
PortsInUse.push(portObj);

portObj = {};
portObj.port = listenPort.toString(); //Tally Arbiter
portObj.sourceId = 'reserved';
PortsInUse.push(portObj);

var source_types 	= [ //available tally source types
	{ id: '5e0a1d8c', label: 'TSL 3.1 UDP', type: 'tsl_31_udp', enabled: true, help: ''},
	{ id: 'dc75100e', label: 'TSL 3.1 TCP', type: 'tsl_31_tcp', enabled: true , help: ''},
	{ id: '44b8bc4f', label: 'Blackmagic ATEM', type: 'atem', enabled: true, help: 'Uses Port 9910.' },
	{ id: '4eb73542', label: 'OBS Studio', type: 'obs', enabled: true, help: 'The OBS Websocket plugin must be installed on the source.'},
	{ id: '58b6af42', label: 'VMix', type: 'vmix', enabled: true, help: 'Uses Port 8099.'},
	{ id: '4a58f00f', label: 'Roland Smart Tally', type: 'roland', enabled: true, help: ''},
	{ id: 'f2b7dc72', label: 'Newtek Tricaster', type: 'tc', enabled: true, help: 'Uses Port 5951.'},
	{ id: '05d6bce1', label: 'Open Sound Control (OSC)', type: 'osc', enabled: true, help: ''},
	{ id: 'cf51e3c9', label: 'Incoming Webhook', type: 'webhook', enabled: false, help: ''}
];

var source_types_datafields = [ //data fields for the tally source types
	{ sourceTypeId: '5e0a1d8c', fields: [ //TSL 3.1 UDP
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' }
		]
	},
	{ sourceTypeId: 'dc75100e', fields: [ //TSL 3.1 TCP
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' }
		]
	},
	{ sourceTypeId: '44b8bc4f', fields: [ //Blackmagic ATEM
			{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' }
		]
	},
	{ sourceTypeId: '4eb73542', fields: [ // OBS Studio
			{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
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
	{ sourceTypeId: '05d6bce1', fields: [ // OSC Listener
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
			{ fieldName: 'info', fieldLabel: 'Information', text: 'The device source address should be sent as an integer or a string to the server\'s IP address on the specified port. Sending to /tally/preview_on designates it as a Preview command, and /tally/program_on designates it as a Program command. To turn off a preview or program, use preview_off and program_off. The first OSC argument received will be used for the device source address.', fieldType: 'info' }
		]
	},
	{ sourceTypeId: 'f2b7dc72', fields: [ // Newtek Tricaster
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
	{ id: '6dbb7bf7', label: 'Local Console Output', type: 'console', enabled: true },
	{ id: '58da987d', label: 'OSC Message', type: 'osc', enabled: true }
];

var output_types_datafields = [ //data fields for the outgoing actions
	{ outputTypeId: '7dcd66b5', fields: [ //TSL 3.1 UDP
			{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
			{ fieldName: 'address', fieldLabel: 'Address', fieldType: 'number' },
			{ fieldName: 'label', fieldLabel: 'Label', fieldType: 'text' },
			{ fieldName: 'tally1', fieldLabel: 'Tally 1 (PVW)', fieldType: 'bool' },
			{ fieldName: 'tally2', fieldLabel: 'Tally 2 (PGM)', fieldType: 'bool' },
			{ fieldName: 'tally3', fieldLabel: 'Tally 3', fieldType: 'bool' },
			{ fieldName: 'tally4', fieldLabel: 'Tally 4', fieldType: 'bool' }
		]
	},
	{ outputTypeId: '276a8dcc', fields: [ //TSL 3.1 TCP
			{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
			{ fieldName: 'address', fieldLabel: 'Address', fieldType: 'number' },
			{ fieldName: 'label', fieldLabel: 'Label', fieldType: 'text' },
			{ fieldName: 'tally1', fieldLabel: 'Tally 1 (PVW)', fieldType: 'bool' },
			{ fieldName: 'tally2', fieldLabel: 'Tally 2 (PGM)', fieldType: 'bool' },
			{ fieldName: 'tally3', fieldLabel: 'Tally 3', fieldType: 'bool' },
			{ fieldName: 'tally4', fieldLabel: 'Tally 4', fieldType: 'bool' }
		]
	},
	{ outputTypeId: 'ffe2b0b6', fields: [ //Outgoing Webhook
			{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
			{ fieldName: 'path', fieldLabel: 'Path', fieldType: 'text' },
			{ fieldName: 'method', fieldLabel: 'Method', fieldType: 'dropdown', options: [ { id: 'GET', label: 'GET' }, { id: 'POST', label: 'POST'} ] },
			{ fieldName: 'postdata', fieldLabel: 'POST Data', fieldType: 'text' }
		]
	},
	{ outputTypeId: '6dbb7bf7', fields: [ //Local Console Output
			{ fieldName: 'text', fieldLabel: 'Text', fieldType: 'text'}
		]
	},
	{ outputTypeId: '58da987d', fields: [ //OSC
			{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
			{ fieldName: 'path', fieldLabel: 'Path', fieldType: 'text' },
			{ fieldName: 'args', fieldLabel: 'Arguments', fieldType: 'text', help: 'Separate multiple argments with a space. Strings must be encapsulated by double quotes.'}
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
	{ id: '334e4eda', label: 'Program', type: 'program'}
	/* { id: '12c8d698', label: 'Preview + Program', type: 'previewprogram'}*/
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
	logger('Setting up the REST API.', 'info-quiet');

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

	//producer page - view tally states of all devices
	app.get('/producer', function (req, res) {
		res.sendFile('views/producer.html', { root: __dirname });
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

	app.get('/tsl_clients', function (req, res) {
		//gets all TSL Clients
		res.send(tsl_clients);
	});

	app.get('/cloud_destinations', function (req, res) {
		//gets all Cloud Destinations
		res.send(cloud_destinations);
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

	logger('REST API Setup Complete.', 'info-quiet');

	logger('Starting socket.IO Setup.', 'info-quiet');

	io.sockets.on('connection', function(socket) {

		socket.on('version', function() {
			socket.emit('version', version);
		});

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

		socket.on('device_listen_blink', function(obj) { // emitted by the Python blink(1) client that has selected a Device to listen for state information
			let deviceId = obj.deviceId;
			let device = GetDeviceByDeviceId(deviceId);
			if ((deviceId === 'null') || (!device)) {
				deviceId = devices[0].id;
			}

			let listenerType = 'blink(1)';

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

		socket.on('device_listen_gpo', function(obj) { // emitted by the Python GPO Controller client that has selected a Device to listen for state information
			let gpoGroupId = obj.gpoGroupId;
			let deviceId = obj.deviceId;
			let device = GetDeviceByDeviceId(deviceId);
			if ((deviceId === 'null') || (!device)) {
				deviceId = devices[0].id;
			}

			let listenerType = 'gpo';

			socket.join('device-' + deviceId);
			let deviceName = GetDeviceByDeviceId(deviceId).name;
			logger(`Listener Client Connected. Type: ${listenerType} Device: ${deviceName}`, 'info');
			
			let ipAddress = socket.request.connection.remoteAddress;
			let datetimeConnected = new Date().getTime();
			
			let clientId = AddClient(socket.id, deviceId, listenerType, ipAddress, datetimeConnected);
			//add gpoGroupId to client
			for (let i = 0; i < Clients.length; i++) {
				if (Clients[i].id === clientId) {
					Clients[i].gpoGroupId = gpoGroupId;
					break;
				}
			}
			socket.emit('listener_relay_assignment', gpoGroupId, deviceId);
		});

		socket.on('device_states', function(deviceId) {
			socket.emit('device_states', GetDeviceStatesByDeviceId(deviceId));
		});

		socket.on('settings', function () {
			socket.join('settings');
			socket.emit('clients', Clients);
			socket.emit('logs', Logs);
			socket.emit('PortsInUse', PortsInUse);
		});

		socket.on('producer', function () {
			socket.join('producer');
			socket.emit('clients', Clients);
			socket.emit('devices', devices);
			socket.emit('bus_options', bus_options);
		});

		socket.on('flash', function(clientId) {
			for (let i = 0; i < Clients.length; i++) {
				if (Clients[i].id === clientId) {
					if (Clients[i].relayGroupId) {
						io.to(Clients[i].socketId).emit('flash', Clients[i].relayGroupId);
					}
					else if (Clients[i].gpoGroupId) {
						io.to(Clients[i].socketId).emit('flash', Clients[i].gpoGroupId);
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
					else if (Clients[i].gpoGroupId) {
						io.to(Clients[i].socketId).emit('reassign', Clients[i].gpoGroupId, oldDeviceId, deviceId);
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

		socket.on('listener_reassign_gpo', function(gpoGroupId, oldDeviceId, deviceId) {
			let canRemove = true;
			for (let i = 0; i < Clients.length; i++) {
				if (Clients[i].socketId === socket.id) {
					if (Clients[i].deviceId === oldDeviceId) {
						if (Clients[i].gpoGroupId !== gpoGroupId) {
							canRemove = false;
							break;
						}
					}
				}
			}
			if (canRemove) {
				//no other gpo groups on this socket are using the old device ID, so we can safely leave that room
				socket.leave('device-' + oldDeviceId);
			}
			
			socket.join('device-' + deviceId);

			for (let i = 0; i < Clients.length; i++) {
				if (Clients[i].gpoGroupId === gpoGroupId) {
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

	logger('Socket.IO Setup Complete.', 'info-quiet');

	logger('Starting OSC Setup.', 'info-quiet');

	oscUDP = new osc.UDPPort({
		localAddress: '0.0.0.0',
		localPort: oscPort,
		broadcast: true,
		metadata: true
	});

	oscUDP.on('error', function (error) {
		logger(`An OSC error occurred: ${error.message}`, 'info-quiet');
	});

	oscUDP.open();

	oscUDP.on('ready', function () {
		logger(`OSC Sending Port Ready. Broadcasting on Port: ${oscPort}`, 'info-quiet');
	});

	if (tsl_clients.length > 0) {
		logger(`Initiating ${tsl_clients.length} TSL Client Connections.`, 'info');

		for (let i = 0; i < tsl_clients.length; i++) {
			logger(`TSL Client: ${tsl_clients[i].ip}:${tsl_clients[i].port} (${tsl_clients[i].transport})`, 'info-quiet');
			tsl_clients[i].connected = false;
			StartTSLClientConnection(tsl_clients[i].id);
		}

		logger(`Finished TSL Client Connections.`, 'info');
	}

	if (cloud_destinations.length > 0) {
		logger(`Initiation ${cloud_destinations.length} Cloud Destination Connections.`, 'info');

		for (let i = 0; i < cloud_destinations.length; i++) {
			logger(`Cloud Destination: ${cloud_destinations[i].host}:${cloud_destinations[i].port}`, 'info-quiet');
			cloud_destinations[i].connected = false;
			StartCloudDestination(cloud_destinations[i].id);
		}

		logger(`Finished Cloud Destinations.`, 'info');
	}

	logger('Starting HTTP Server.', 'info-quiet');
	
	httpServer.listen(listenPort, function () { // start up http server
		logger(`Tally Arbiter running on port ${listenPort}`, 'info');
	});
}

function logger(log, type) { //logs the item to the console, to the log array, and sends the log item to the settings page

	let dtNow = new Date();

	switch(type) {
		case 'info':
		case 'info-quiet':
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
	
	if (type.indexOf('quiet') === -1) {
		let logObj = {};
		logObj.datetime = dtNow;
		logObj.log = log;
		logObj.type = type;
		Logs.push(logObj);

		io.to('settings').emit('log_item', logObj);
	}
}

function loadConfig() { // loads the JSON data from the config file to memory
	logger('Loading the stored Tally Arbiter configuration file.', 'info-quiet');

	try {
		let rawdata = fs.readFileSync(config_file);
		let configJson = JSON.parse(rawdata); 

		if (configJson.sources) {
			for (let i = 0; i < configJson.sources.length; i++) {
				configJson.sources[i].connected = false;
			}
			sources = configJson.sources;
			logger('Tally Arbiter Sources loaded.', 'info');
			logger(`${sources.length} Sources configured.`, 'info');
		}
		else {
			sources = [];
			logger('Tally Arbiter Sources could not be loaded.', 'error');
		}
		
		if (configJson.devices) {
			devices = configJson.devices;
			logger('Tally Arbiter Devices loaded.', 'info');
			logger(`${devices.length} Devices configured.`, 'info');
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

		if (configJson.tsl_clients) {
			tsl_clients = configJson.tsl_clients;
			logger('Tally Arbiter TSL Clients loaded.', 'info');
		}
		else {
			tsl_clients = [];
			logger('Tally Arbiter TSL Clients could not be loaded.', 'error');
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

			logger(`Initiating Setup for Source: ${sources[i].name}. Type: ${sourceType.label}`, 'info-quiet');
			
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
				case 'osc':
					SetUpOSCServer(sources[i].id);
					break;
				case 'tc':
					SetUpTricasterServer(sources[i].id);
					break;
				default:
					logger(`Error initiating connection for Source: ${sources[i].name}. The specified Source Type is not implemented at this time: ${sourceType.type}`, 'error');
					break;
			}
		}
	}

	logger('Source Setup Complete.', 'info-quiet');

	initializeDeviceStates();
}

function initializeDeviceStates() { // initializes each device state in the array upon server startup
	logger('Initializing Device States.', 'info-quiet');

	let busId_preview = null;
	let busId_program = null;
	//let busId_previewprogram = null;

	for (let i = 0; i < bus_options.length; i++) {
		switch(bus_options[i].type) {
			case 'preview':
				busId_preview = bus_options[i].id;
				break;
			case 'program':
				busId_program = bus_options[i].id;
				break;
			/*case 'previewprogram':
				busId_previewprogram = bus_options[i].id;
				break;*/
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

		/*let deviceStateObj_previewprogram = {};
		deviceStateObj_previewprogram.deviceId = devices[i].id;
		deviceStateObj_previewprogram.busId = busId_previewprogram;
		deviceStateObj_previewprogram.sources = [];
		device_states.push(deviceStateObj_previewprogram);*/
	}

	logger('Device States Initialized.', 'info-quiet');
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
				AddPort(port, sourceId);
				logger(`Source: ${source.name}  Creating TSL UDP Connection.`, 'info-quiet');
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
		logger(`Source: ${source.name}  TSL 3.1 UDP Server Error occurred: ${error}`, 'error');
	}
}

function StopTSLServer_UDP(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);

	try
	{
		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				logger(`Source: ${source.name}  Closing TSL UDP Connection.`, 'info-quiet');
				source_connections[i].server.server.close();
				DeletePort(source.data.port);
				logger(`Source: ${source.name}  TSL 3.1 UDP Server Stopped. Connection Closed.`, 'info');
				for (let j = 0; j < sources.length; j++) {
					if (sources[j].id === sourceId) {
						sources[j].connected = false;
						break;
					}
				}
				break;
			}
		}

		io.to('settings').emit('sources', sources);
	}
	catch (error) {
		logger(`Source: ${source.name}  TSL 3.1 UDP Server Error occurred: ${error}`, 'error');
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
				AddPort(port, sourceId);
				logger(`Source: ${source.name}  Creating TSL TCP Connection.`, 'info-quiet');
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
		logger(`Source: ${source.name}  TSL 3.1 TCP Server Error occurred: ${error}`, 'error');
	}
}

function StopTSLServer_TCP(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);

	try
	{	
		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				source_connections[i].server.close(function() {});
				DeletePort(source.data.port);
				logger(`Source: ${source.name}  TSL 3.1 TCP Server Stopped.`, 'info');
				for (let j = 0; j < sources.length; j++) {
					if (sources[j].id === sourceId) {
						sources[j].connected = false;
						break;
					}
				}
				break;
			}
		}

		io.to('settings').emit('sources', sources);
	}
	catch (error) {
		logger(`Source: ${source.name}  TSL 3.1 UDP Server Error occurred: ${error}`, 'error');
	}
}

function SetUpATEMServer(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);

	try {
		let atemIP = source.data.ip;

		let sourceConnectionObj = {};
		sourceConnectionObj.sourceId = sourceId;
		sourceConnectionObj.server = null;
		source_connections.push(sourceConnectionObj);

		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				try {
					logger(`Source: ${source.name}  Creating ATEM Connection.`, 'info-quiet');
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
								logger(`Source: ${source.name} ATEM connection closed.`, 'info');
								io.to('settings').emit('sources', sources);
								break;
							case 'attempting':
								logger(`Source: ${source.name}  Initiating connection to ATEM: ${source.data.ip}`, 'info');
								break;
							case 'establishing':
								logger(`Source: ${source.name}  Establishing ATEM connection.`, 'info-quiet');
								break;
							case 'open':
								for (let j = 0; j < sources.length; j++) {
									if (sources[j].id === sourceId) {
										sources[j].connected = true;
										break;
									}
								}
								logger(`Source: ${source.name} ATEM connection opened.`, 'info');
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

						logger(`Source: ${source.name}  Connection to ATEM lost.`, 'info-quiet');

						io.to('settings').emit('sources', sources);
					});

					source_connections[i].server.on('sourceConfiguration', function (id, config, info) {
						
					});

					source_connections[i].server.on('sourceTally', function (sourceNumber, tallyState) {
						logger(`Source: ${source.name}  ATEM Source Tally Data received.`, 'info-quiet');
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
				}
				catch(error) {
					logger(`ATEM Error: ${error}`, 'error');
				}

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
			logger(`Source: ${source.name}  ATEM connection closed.`, 'info');
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
				try {
					logger(`Source: ${source.name}  Creating OBS Websocket connection.`, 'info-quiet');
					source_connections[i].server = new OBS();
					source_connections[i].server.ip = ip;
					source_connections[i].server.connect({address: ip + ':' + port, password: password}, function (data) {
						logger(`Source: ${source.name}  Connected to OBS @ ${ip}:${port}`, 'info');
					})
					.catch(function (error) {
						if (error.code === 'CONNECTION_ERROR') {
							logger(`Source: ${source.name}  OBS websocket connection error. Is OBS running?`, 'error');
						}
					});

					source_connections[i].server.on('error', function(error) {
						logger(`Source: ${source.name}  OBS websocket error: ${error}`, 'error');
					});

					source_connections[i].server.on('ConnectionOpened', function (data) {
						logger(`Source: ${source.name}  OBS Connection opened.`, 'info');
						for (let j = 0; j < sources.length; j++) {
							if (sources[j].id === sourceId) {
								sources[j].connected = true;
								break;
							}
						}
						io.to('settings').emit('sources', sources);
					});

					source_connections[i].server.on('ConnectionClosed', function (data) {
						logger(`Source: ${source.name} OBS Connection closed.`, 'info');
						for (let j = 0; j < sources.length; j++) {
							if (sources[j].id === sourceId) {
								sources[j].connected = false;
								break;
							}
						}
						io.to('settings').emit('sources', sources);
					});

					source_connections[i].server.on('AuthenticationSuccess', function (data) {
						logger(`Source: ${source.name}  OBS Authenticated.`, 'info-quiet');
					});

					source_connections[i].server.on('AuthenticationFailure', function (data) {
						logger(`Source: ${source.name}  Invalid OBS Password.`, 'info');
					});

					source_connections[i].server.on('PreviewSceneChanged', function (data) {
						logger(`Source: ${source.name}  Preview Scene Changed.`, 'info-quiet');
						if (data)
						{
							if (data.sources)
							{
								processOBSTally(sourceId, data.sources, 'preview');
							}
						}
					});

					source_connections[i].server.on('SwitchScenes', function (data) {
						logger(`Source: ${source.name}  Program Scene Changed.`, 'info-quiet');
						if (data)
						{
							if (data.sources)
							{
								processOBSTally(sourceId, data.sources, 'program');
							}
						}
					});
				}
				catch(error) {
					logger(`Source: ${source.name}  OBS Error: ${error}`, 'error');
				}

				break;
			}
		}
	}
	catch (error) {
		logger(`Source: ${source.name}  OBS Error: ${error}`, 'error');
	}
}

function processOBSTally(sourceId, sourceArray, tallyType) {
	for (let i = 0; i < sourceArray.length; i++) {
		let obsSourceFound = false;
		for (let j = 0; j < tallydata_OBS.length; j++) {
			if (tallydata_OBS[j].sourceId === sourceId) {
				if (tallydata_OBS[j].address === sourceArray[i].name) {
					obsSourceFound = true;
					break;
				}
			}
		}

		if (!obsSourceFound) {
			//the source is not in the OBS array, we don't know anything about it, so add it to the array
			let obsTallyObj = {};
			obsTallyObj.sourceId = sourceId;
			obsTallyObj.label = sourceArray[i].name;
			obsTallyObj.address = sourceArray[i].name;
			obsTallyObj.tally4 = 0;
			obsTallyObj.tally3 = 0;
			obsTallyObj.tally2 = 0; // PGM
			obsTallyObj.tally1 = 0; // PVW
			tallydata_OBS.push(obsTallyObj);
		}
	}

	for (let i = 0; i < tallydata_OBS.length; i++) {
		let obsSourceFound = false;
		for (let j = 0; j < sourceArray.length; j++) {
			if (tallydata_OBS[i].sourceId === sourceId) {
				if (tallydata_OBS[i].address === sourceArray[j].name) {
					obsSourceFound = true;
					//update the tally state because OBS is saying this source is not in the current scene
					switch(tallyType) {
						case 'preview':
							tallydata_OBS[i].tally1 = ((sourceArray[j].render) ? 1 : 0);
							break;
						case 'program':
							tallydata_OBS[i].tally2 = ((sourceArray[j].render) ? 1 : 0);
							break;
						default:
							break;
					}
					processTSLTally(sourceId, tallydata_OBS[i]);
					break;
				}
			}
		}

		if (!obsSourceFound) {
			//it is no longer in the bus, mark it as such
			switch(tallyType) {
				case 'preview':
					tallydata_OBS[i].tally1 = 0;
					break;
				case 'program':
					tallydata_OBS[i].tally2 = 0;
					break;
				default:
					break;
			}
			processTSLTally(sourceId, tallydata_OBS[i]);
		}
	}
}

function StopOBSServer(sourceId) {
	let source = GetSourceBySourceId(sourceId);
	
	for (let i = 0; i < source_connections.length; i++) {
		if (source_connections[i].sourceId === sourceId) {
			logger(`Source: ${source.name}  Closing OBS connection.`, 'info-quiet');
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
				logger(`Source: ${source.name}  Creating VMix connection.`, 'info-quiet');
				source_connections[i].server = new net.Socket();
				source_connections[i].server.connect(port, ip, function() {
					logger(`Source: ${source.name}  VMix Connection Opened.`, 'info');
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
					logger(`Source: ${source.name}  VMix data received.`, 'info-quiet');
					data = data
					.toString()
					.split(/\r?\n/);

					tallyData = data.filter(text => text.startsWith('TALLY OK'));

					if (tallyData.length > 0) {
						logger(`Source: ${source.name}  VMix tally data received.`, 'info-quiet');
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
					logger(`Source: ${source.name}  VMix Connection closed.`, 'info');
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
		logger(`Source: ${source.name}. VMix Error Occurred: ${error}`, 'error');
	}
}

function StopVMixServer(sourceId) {
	let source = GetSourceBySourceId(sourceId);
	
	for (let i = 0; i < source_connections.length; i++) {
		if (source_connections[i].sourceId === sourceId) {
			logger(`Source: ${source.name}  Closing VMix connection.`, 'info-quiet');
			source_connections[i].server.write('QUIT\r\n');
			break;
		}
	}
}

function SetUpRolandSmartTally(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);
	let ip = source.data.ip;

	try {
		let sourceConnectionObj = {};
		sourceConnectionObj.sourceId = sourceId;
		sourceConnectionObj.server = null;
		source_connections.push(sourceConnectionObj);

		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				logger(`Source: ${source.name}  Opening Roland Smart Tally connection.`, 'info-quiet');
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
								logger(`Source: ${source.name}  Roland Smart Tally Error: ${error}`, 'error');
							});
						}
					}
				}, 1000, sourceId);
				break;
			}
		}

		io.to('settings').emit('sources', sources);
	}
	catch (error) {
		logger(`Source: ${source.name}. Roland Smart Tally Error: ${error}`, 'error');
	}
}

function StopRolandSmartTally(sourceId) {
	let source = GetSourceBySourceId(sourceId);
	
	for (let i = 0; i < source_connections.length; i++) {
		if (source_connections[i].sourceId === sourceId) {
			clearInterval(source_connections[i].server);
			logger(`Source: ${source.name}  Roland Smart Tally connection closed`, 'info');
			break;
		}
	}

	for (let j = 0; j < sources.length; j++) {
		if (sources[j].id === sourceId) {
			sources[j].connected = false;
			break;
		}
	}

	io.to('settings').emit('sources', sources);
}

function SetUpOSCServer(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);

	try {
		let sourceConnectionObj = {};
		sourceConnectionObj.sourceId = sourceId;
		sourceConnectionObj.server = null;
		source_connections.push(sourceConnectionObj);

		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				AddPort(source.data.port, sourceId);
				logger(`Source: ${source.name}  Creating new OSC connection.`, 'info-quiet');
				source_connections[i].server = new osc.UDPPort({
					localAddress: '0.0.0.0',
					localPort: source.data.port,
					metadata: true
				});
			
				source_connections[i].server.on('message', function (oscMsg, timeTag, info) {
					logger(`Source: ${source.name} OSC message received: ${oscMsg.address} ${oscMsg.args[0].value.toString()}`, 'info-quiet');
					let tallyObj = {};
					tallyObj.address = oscMsg.args[0].value.toString();
					tallyObj.label = tallyObj.address;
					switch(oscMsg.address) {
						case '/tally/preview_on':
							tallyObj.tally1 = 1;
							break;
						case '/tally/preview_off':
							tallyObj.tally1 = 0;
							break;
						case '/tally/program_on':
							tallyObj.tally2 = 1;
							break;
						case '/tally/program_off':
							tallyObj.tally2 = 0;
							break;
						default:
							break;
					}
					processTSLTally(source.id, tallyObj);
				});
			
				source_connections[i].server.on('error', function (error) {
					console.log('An error occurred: ', error.message);
				});

				source_connections[i].server.on('ready', function () {
					logger(`Source: ${source.name}  OSC port ${source.data.port} ready.`, 'info-quiet');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = true;
							io.to('settings').emit('sources', sources);
							break;
						}
					}
				});
			
				source_connections[i].server.open();
				break;
			}
		}
	}
	catch (error) {
		logger(`Source: ${source.name} OSC Error: ${error}`, 'error');
	}
}

function StopOSCServer(sourceId) {
	let source = GetSourceBySourceId(sourceId);

	for (let i = 0; i < source_connections.length; i++) {
		if (source_connections[i].sourceId === sourceId) {
			source_connections[i].server.close();
			DeletePort(source.data.port);
			logger(`Source: ${source.name}  OSC connection closed.`, 'info');
			break;
		}
	}

	for (let j = 0; j < sources.length; j++) {
		if (sources[j].id === sourceId) {
			sources[j].connected = false;
			break;
		}
	}

	io.to('settings').emit('sources', sources);
}

function SetUpTricasterServer(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);
	let ip = source.data.ip;
	let port = 5951;

	try
	{
		let sourceConnectionObj = {};
		sourceConnectionObj.sourceId = sourceId;
		sourceConnectionObj.server = null;
		source_connections.push(sourceConnectionObj);

		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				logger(`Source: ${source.name}  Creating Tricaster Connection.`, 'info-quiet');
				source_connections[i].server = new net.Socket();
				source_connections[i].server.connect({port: port, host: ip}, function() {
					let tallyCmd = '<register name="NTK_states"/>';
					source_connections[i].server.write(tallyCmd + '\n');
					logger(`Source: ${source.name}  Tricaster Connection opened. Listening for data.`, 'info');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = true;
							break;
						}
					}
				});

				source_connections[i].server.on('data', function(data) {
					try {
						data = '<data>' + data.toString() + '</data>';

						let parseString = xml2js.parseString;
						
						parseString(data, function (error, result) {
							if (error) {
								console.log('error:' + error);
							}
							else {
								let shortcut_states = Object.entries(result['data']['shortcut_states']);
						
								for (const [name, value] of shortcut_states) {
									let shortcut_state = value['shortcut_state'];
									for (let j = 0; j < shortcut_state.length; j++) {
										switch(shortcut_state[j]['$'].name) {
											case 'program_tally':
											case 'preview_tally':
												let tallyValue = shortcut_state[j]['$'].value;
												let addresses = tallyValue.split('|');
												processTricasterTally(sourceId, addresses, shortcut_state[j]['$'].name);
												break;
											default:
												break;
										}
									}
								}
							}
						});
					}
					catch(error) {

					}
				});

				source_connections[i].server.on('close', function() {

					logger(`Source: ${source.name}  Tricaster Connection Stopped.`, 'info');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = false;
							break;
						}
					}

					io.to('settings').emit('sources', sources);
				});

				source_connections[i].server.on('error', function(error) {
					logger(`Source: ${source.name}  Tricaster Connection Error occurred: ${error}`, 'error');
				});
				break;
			}
		}
	}
	catch (error) {
		logger(`Source: ${source.name}  Tricaster Error occurred: ${error}`, 'error');
	}
}

function processTricasterTally(sourceId, sourceArray, tallyType) {
	for (let i = 0; i < sourceArray.length; i++) {
		let tricasterSourceFound = false;
		for (let j = 0; j < tallydata_TC.length; j++) {
			if (tallydata_TC[j].sourceId === sourceId) {
				if (tallydata_TC[j].address === sourceArray[i]) {
					tricasterSourceFound = true;
					break;
				}
			}
		}

		if (!tricasterSourceFound) {
			//the source is not in the Tricaster array, we don't know anything about it, so add it to the array
			let tricasterTallyObj = {};
			tricasterTallyObj.sourceId = sourceId;
			tricasterTallyObj.label = sourceArray[i];
			tricasterTallyObj.address = sourceArray[i];
			tricasterTallyObj.tally4 = 0;
			tricasterTallyObj.tally3 = 0;
			tricasterTallyObj.tally2 = 0; // PGM
			tricasterTallyObj.tally1 = 0; // PVW
			tallydata_TC.push(tricasterTallyObj);
		}
	}

	for (let i = 0; i < tallydata_TC.length; i++) {
		let tricasterSourceFound = false;
		for (let j = 0; j < sourceArray.length; j++) {
			if (tallydata_TC[i].sourceId === sourceId) {
				if (tallydata_TC[i].address === sourceArray[j]) {
					tricasterSourceFound = true;
					//update the tally state because Tricaster is saying this source is in the current bus
					switch(tallyType) {
						case 'preview_tally':
							tallydata_TC[i].tally1 = 1;
							break;
						case 'program_tally':
							tallydata_TC[i].tally2 = 1;
							break;
						default:
							break;
					}
					processTSLTally(sourceId, tallydata_TC[i]);
					break;
				}
			}
		}

		if (!tricasterSourceFound) {
			//it is no longer in the bus, mark it as such
			switch(tallyType) {
				case 'preview_tally':
					tallydata_TC[i].tally1 = 0;
					break;
				case 'program_tally':
					tallydata_TC[i].tally2 = 0;
					break;
				default:
					break;
			}
			processTSLTally(sourceId, tallydata_TC[i]);
		}
	}
}

function StopTricasterServer(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);

	try
	{	
		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				let tallyCmd = '<unregister name="NTK_states"/>';
				source_connections[i].server.write(tallyCmd + '\n');
				source_connections[i].server.end();
				source_connections[i].server.destroy();
				break;
			}
		}
	}
	catch (error) {
		logger(`Source: ${source.name}  Tricaster Connection Error occurred: ${error}`, 'error');
	}
}

function processTSLTally(sourceId, tallyObj) // Processes the TSL Data
{
	logger(`Processing new tally object.`, 'info-quiet');

	io.to('settings').emit('tally_data', sourceId, tallyObj);

	let deviceId = null;

	for (let i = 0; i < device_sources.length; i++) {
		if ((device_sources[i].sourceId === sourceId) && (device_sources[i].address === tallyObj.address.toString())) {
			deviceId = device_sources[i].deviceId;
			break;
		}
	}

	let busId_preview = null;
	let busId_program = null;
	//let busId_previewprogram = null;

	for (let i = 0; i < bus_options.length; i++) {
		switch(bus_options[i].type) {
			case 'preview':
				busId_preview = bus_options[i].id;
				break;
			case 'program':
				busId_program = bus_options[i].id;
				break;
			/*case 'previewprogram':
				busId_previewprogram = bus_options[i].id;
				break;*/
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

		/*for (let i = 0; i < device_states.length; i++) {
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
						//if the device is currently not marked as in preview+program, let's check and see if we should include it
						if ((inPreview) && (inProgram)) {
							//add it, it's not already in preview+program on this source
							device_states[i].sources.push(sourceId);
						}
					}
				}
			}
		}*/

		UpdateDeviceState(deviceId);
		io.to('settings').emit('device_states', device_states);
		io.to('producer').emit('device_states', device_states);
		SendTSLClientData(deviceId);
	}
}

function UpdateDeviceState(deviceId) {
	let busId_preview = null;
	let busId_program = null;
	//let busId_previewprogram = null;

	for (let i = 0; i < bus_options.length; i++) {
		switch(bus_options[i].type) {
			case 'preview':
				busId_preview = bus_options[i].id;
				break;
			case 'program':
				busId_program = bus_options[i].id;
				break;
			/*case 'previewprogram':
				busId_previewprogram = bus_options[i].id;
				break;*/
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
			/*else if (device_states[i].busId === busId_previewprogram) {
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
			}*/
		}
	}
}

function RunAction(deviceId, busId, active) {
	let actionObj = null;

	let deviceObj = GetDeviceByDeviceId(deviceId);

	if (deviceObj.enabled === true) {
		let filteredActions = device_actions.filter(obj => obj.deviceId === deviceId);
		if (filteredActions.length > 0) {
			for (let i = 0; i < filteredActions.length; i++) {
				if ((filteredActions[i].busId === busId) && (filteredActions[i].active === active)) {
					logger(`Running Actions for Device: ${deviceObj.name}`, 'info');
					actionObj = filteredActions[i];
					
					let outputType = output_types.find( ({ id }) => id === actionObj.outputTypeId);
	
					logger(`Running action: ${deviceObj.name}:${GetBusByBusId(filteredActions[i].busId).label}:${(active ? 'On' : 'Off')}  ${outputType.label}  ${filteredActions[i].id}`, 'info');
	
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
						case 'console':
							logger(actionObj.data, 'console_action');
							break;
						case 'osc':
							RunAction_OSC(actionObj.data);
							break;
						default:
							logger(`Device Action: ${filteredActions[i].id}  Error: Unsupported Output Type: ${outputType.type}`, 'error');
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
	
	logger(`Sending device states for: ${deviceObj.name}`, 'info-quiet');
	io.to('device-' + deviceId).emit('device_states', GetDeviceStatesByDeviceId(deviceId));
}

function RunAction_TSL_31_UDP(data) {
	try {
		let bufUMD = Buffer.alloc(18, 0); //ignores spec and pad with 0 for better aligning on Decimator etc
		bufUMD[0] = 0x80 + parseInt(data.address);
		bufUMD.write(data.label, 2);
	
		let bufTally = 0x30;
		
		if (data.tally1) {
			bufTally |= 1;
		}
		if (data.tally2) {
			bufTally |= 2;
		}
		if (data.tally3) {
			bufTally |= 4;
		}
		if (data.tally4) {
			bufTally |= 8;
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
	
		let bufTally = 0x30;
		
		if (data.tally1) {
			bufTally |= 1;
		}
		if (data.tally2) {
			bufTally |= 2;
		}
		if (data.tally3) {
			bufTally |= 4;
		}
		if (data.tally4) {
			bufTally |= 8;
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
		let path = (data.path.startsWith('/') ? data.path : '/' + data.path);
		let options = {
			method: data.method,
			url: 'http://' + data.ip + ':' + data.port + path
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

function RunAction_OSC(data) {
	let args = [];



	if (data.args !== '') {
		let arguments = data.args.split(' ');
		let arg;

		for (let i = 0; i < arguments.length; i++) {
			if (isNaN(arguments[i])) {
				arg = {
					type: 's',
					value: arguments[i].replace(/"/g, '').replace(/'/g, '')
				};
				args.push(arg);
			}
			else if (arguments[i].indexOf('.') > -1) {
				arg = {
					type: 'f',
					value: parseFloat(arguments[i])
				};
				args.push(arg);
			}
			else {
				arg = {
					type: 'i',
					value: parseInt(arguments[i])
				};
				args.push(arg);
			}
		}
	}

	logger(`Sending OSC Message: ${data.ip}:${data.port} ${data.path} ${data.args}`, 'info');
	console.log(args);
	oscUDP.send({address: data.path, args: args}, data.ip, data.port);
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
		case 'tsl_client':
			if (obj.action === 'add') {
				result = TallyArbiter_Add_TSL_Client(obj);
			}
			else if (obj.action === 'edit') {
				result = TallyArbiter_Edit_TSL_Client(obj);
			}
			else if (obj.action === 'delete') {
				result = TallyArbiter_Delete_TSL_Client(obj);
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
			device_actions: device_actions,
			tsl_clients: tsl_clients
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
		case 'osc':
			SetUpOSCServer(sourceId);
			break;
		case 'tc':
			SetUpTricasterServer(sourceId);
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
		case 'osc':
			StopOSCServer(sourceId);
			break;
		case 'tc':
			StopTricasterServer(sourceId);
			break;
		default:
			break;
	}
}

function StartTSLClientConnection(tslClientId) {
	for (let i = 0; i < tsl_clients.length; i++) {
		if (tsl_clients[i].id === tslClientId) {
			switch(tsl_clients[i].transport) {
				case 'udp':
					logger(`TSL Client: ${tslClientId}  Initiating TSL Client UDP Socket.`, 'info-quiet');
					tsl_clients[i].socket = dgram.createSocket('udp4');
					tsl_clients[i].socket.on('error', function(error) {
						logger(`An error occurred with the connection to ${tsl_clients[i].ip}:${tsl_clients[i].port}  ${error}`, 'error');
						tsl_clients[i].error = true;
						if (error.toString().indexOf('ECONNREFUSED') > -1) {
							tsl_clients[i].connected = false;
						}
						io.to('settings').emit('tsl_clients', tsl_clients);
					});
					tsl_clients[i].socket.on('connect', function() {
						logger(`TSL Client ${tslClientId} Connection Established: ${tsl_clients[i].ip}:${tsl_clients[i].port}`, 'info-quiet');
						tsl_clients[i].error = false;
						tsl_clients[i].connected = true;
						io.to('settings').emit('tsl_clients', tsl_clients);
					});
					tsl_clients[i].socket.on('close', function() {
						logger(`TSL Client ${tslClientId} Connection Closed: ${tsl_clients[i].ip}:${tsl_clients[i].port}`, 'info-quiet');
						tsl_clients[i].error = false;
						tsl_clients[i].connected = false;
						io.to('settings').emit('tsl_clients', tsl_clients);
					});
					tsl_clients[i].connected = true;
					break;
				case 'tcp':
					logger(`TSL Client: ${tslClientId}  Initiating TSL Client TCP Socket.`, 'info-quiet');
					tsl_clients[i].socket = new net.Socket();
					tsl_clients[i].socket.on('error', function(error) {
						logger(`An error occurred with the connection to ${tsl_clients[i].ip}:${tsl_clients[i].port}  ${error}`, 'error');
						tsl_clients[i].error = true;
						if (error.toString().indexOf('ECONNREFUSED') > -1) {
							tsl_clients[i].connected = false;
						}
						io.to('settings').emit('tsl_clients', tsl_clients);
					});
					tsl_clients[i].socket.on('connect', function() {
						logger(`TSL Client ${tslClientId} Connection Established: ${tsl_clients[i].ip}:${tsl_clients[i].port}`, 'info-quiet');
						tsl_clients[i].error = false;
						tsl_clients[i].connected = true;
						io.to('settings').emit('tsl_clients', tsl_clients);
					});
					tsl_clients[i].socket.on('close', function() {
						logger(`TSL Client ${tslClientId} Connection Closed: ${tsl_clients[i].ip}:${tsl_clients[i].port}`, 'info-quiet');
						tsl_clients[i].error = false;
						tsl_clients[i].connected = false;
						io.to('settings').emit('tsl_clients', tsl_clients);
					});
					tsl_clients[i].socket.connect(parseInt(tsl_clients[i].port), tsl_clients[i].ip);
					break;
				default:
					break;
			}
			break;
		}
	}
}

function StopTSLClientConnection(tslClientId) {
	for (let i = 0; i < tsl_clients.length; i++) {
		if (tsl_clients[i].id === tslClientId) {
			switch(tsl_clients[i].transport) {
				case 'udp':
					logger(`TSL Client: ${tslClientId}  Closing TSL Client UDP Socket.`, 'info-quiet');
					tsl_clients[i].socket.close();
					break;
				case 'tcp':
					logger(`TSL Client: ${tslClientId}  Closing TSL Client TCP Socket.`, 'info-quiet');
					tsl_clients[i].socket.end();
					break;
				default:
					break;
			}
			break;
		}
	}
}

function SendTSLClientData(deviceId) {
	let device = GetDeviceByDeviceId(deviceId);

	let filtered_device_states = GetDeviceStatesByDeviceId(deviceId);

	let tslAddress = (device.tslAddress) ? parseInt(device.tslAddress) : 0;

	if (tslAddress !== 0) {
		let bufUMD = Buffer.alloc(18, 0); //ignores spec and pad with 0 for better aligning on Decimator etc
		bufUMD[0] = 0x80 + tslAddress;
		bufUMD.write(device.name, 2);
	
		for (let i = 0; i < filtered_device_states.length; i++) {
			if (GetBusByBusId(filtered_device_states[i].busId).type === 'preview') {
				if (filtered_device_states[i].sources.length > 0) {
					mode_preview = true;
				}
				else {
					mode_preview = false;
				}
			}
			else if (GetBusByBusId(filtered_device_states[i].busId).type === 'program') {
				if (filtered_device_states[i].sources.length > 0) {
					mode_program = true;
				}
				else {
					mode_program = false;
				}
			}
		}
	
		let data = {};
	
		if (mode_preview) {
			data.tally1 = 1;
		}
		else {
			data.tally1 = 0;
		}
	
		if (mode_program) {
			data.tally2 = 1;
		}
		else {
			data.tally2 = 0;
		}
	
		data.tally3 = 0;
		data.tally4 = 0;
	
		let bufTally = 0x30;
		
		if (data.tally1) {
			bufTally |= 1;
		}
		if (data.tally2) {
			bufTally |= 2;
		}
		if (data.tally3) {
			bufTally |= 4;
		}
		if (data.tally4) {
			bufTally |= 8;
		}
		bufUMD[1] = bufTally;
	
		for (let i = 0; i < tsl_clients.length; i++) {
			if (tsl_clients[i].connected === true) {
				switch(tsl_clients[i].transport) {
					case 'udp':
						try {
							tsl_clients[i].socket.send(bufUMD, parseInt(tsl_clients[i].port), tsl_clients[i].ip);
						}
						catch(error) {
							logger(`An error occurred sending TSL data to ${tsl_clients[i].ip}:${tsl_clients[i].port}  ${error}`, 'error');
							tsl_clients[i].error = true;
						}
						break;
					case 'tcp':
						try {
							tsl_clients[i].socket.write(bufUMD);
						}
						catch(error) {
							logger(`An error occurred sending TSL data to ${tsl_clients[i].ip}:${tsl_clients[i].port}  ${error}`, 'error');
							tsl_clients[i].error = true;
						}
						break;
					default:
						break;
				}
			}
		}
	}
}

function StartCloudDestination(cloudId) {
	for (let i = 0; i < cloud_destinations.length; i++) {
		if (cloud_destinations[i].id === cloudId) {
			logger(`Cloud Destination: ${cloudId}  Initiating Connection.`, 'info-quiet');

			cloud_destinations[i].socket = io.connect('http://' + cloud_destinations[i].host + ':' + cloud_destinations[i].port, {reconnection: true});

			cloud_destinations[i].socket.on('connect', function() { 
				cloud_destinations[i].socket.emit('cloud_initialdata', cloud_destinations[i].key, sources, devices, device_sources, device_states);
			});

			cloud_destinations[i].socket.on('error', function(error) {
				logger(`An error occurred with the connection to ${cloud_destinations[i].host}:${cloud_destinations[i].port}  ${error}`, 'error');
				cloud_destinations[i].error = true;
				io.to('settings').emit('cloud_destinations', cloud_destinations);
			});

			cloud_destinations[i].socket.on('disconnect', function() { 
				logger(`Cloud Connection Disconnected: ${cloud_destinations[i].host}:${cloud_destinations[i].port}  ${error}`, 'error');
				cloud_destinations[i].connected = false;
				io.to('settings').emit('cloud_destinations', cloud_destinations);
			});

			break;
		}
	}
}

function StopCloudDestination(cloudId) {
	for (let i = 0; i < cloud_destinations.length; i++) {
		if (cloud_destinations[i].id === cloudId) {
			logger(`Cloud Destination: ${cloudId}  Closing Connection.`, 'info-quiet');
			cloud_destinations[i].socket.close();
			break;
		}
	}
}

function SendCloudData(deviceId) {
	let filtered_device_states = GetDeviceStatesByDeviceId(deviceId);
	
	for (let i = 0; i < cloud_destinations.length; i++) {
		if (cloud_destinations[i].connected === true) {
			try {
				cloud_destinations[i].socket.emit('cloud_data', deviceId, filtered_device_states);
			}
			catch(error) {
				logger(`An error occurred sending Cloud data to ${cloud_destinations[i].host}:${cloud_destinations[i].port}  ${error}`, 'error');
				cloud_destinations[i].error = true;
			}
		}
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
	io.to('producer').emit('device_states', device_states);

	logger(`Source Deleted: ${sourceName}`, 'info');

	return {result: 'source-deleted-successfully'};
}

function TallyArbiter_Add_Device(obj) {
	let deviceObj = obj.device;
	deviceObj.id = uuidv4();
	devices.push(deviceObj);

	let busId_preview = null;
	let busId_program = null;
	//let busId_previewprogram = null;

	for (let i = 0; i < bus_options.length; i++) {
		switch(bus_options[i].type) {
			case 'preview':
				busId_preview = bus_options[i].id;
				break;
			case 'program':
				busId_program = bus_options[i].id;
				break;
			/*case 'previewprogram':
				busId_previewprogram = bus_options[i].id;
				break;*/
			default:
				break;
		}
	}

	let deviceStateObj_preview = {};
	deviceStateObj_preview.deviceId = deviceObj.id;
	deviceStateObj_preview.busId = busId_preview;
	deviceStateObj_preview.sources = [];
	device_states.push(deviceStateObj_preview);

	let deviceStateObj_program = {};
	deviceStateObj_program.deviceId = deviceObj.id;
	deviceStateObj_program.busId = busId_program;
	deviceStateObj_program.sources = [];
	device_states.push(deviceStateObj_program);

	/*let deviceStateObj_previewprogram = {};
	deviceStateObj_previewprogram.deviceId = deviceObj.id;
	deviceStateObj_previewprogram.busId = busId_previewprogram;
	deviceStateObj_previewprogram.sources = [];
	device_states.push(deviceStateObj_previewprogram);*/

	SendTSLClientData(deviceObj.id);

	logger(`Device Added: ${deviceObj.name}`, 'info');

	return {result: 'device-added-successfully'};
}

function TallyArbiter_Edit_Device(obj) {
	let deviceObj = obj.device;
	for (let i = 0; i < devices.length; i++) {
		if (devices[i].id === deviceObj.id) {
			devices[i].name = deviceObj.name;
			devices[i].description = deviceObj.description;
			devices[i].tslAddress = deviceObj.tslAddress;
			devices[i].enabled = deviceObj.enabled;
		}
	}

	SendTSLClientData(deviceObj.id);

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

	let deviceName = GetDeviceByDeviceId(deviceId).name;
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

function TallyArbiter_Add_TSL_Client(obj) {
	let tslClientObj = obj.tslClient;
	tslClientObj.id = uuidv4();
	tsl_clients.push(tslClientObj);

	logger(`TSL Client Added: ${tslClientObj.ip}:${tslClientObj.port} (${tslClientObj.transport})`, 'info');

	StartTSLClientConnection(tslClientObj.id);

	return {result: 'tsl-client-added-successfully'};
}

function TallyArbiter_Edit_TSL_Client(obj) {
	let tslClientObj = obj.tslClient;

	for (let i = 0; i < tsl_clients.length; i++) {
		if (tsl_clients[i].id === tslClientObj.id) {
			//something was changed so we need to stop and restart the connection
			StopTSLClientConnection(tslClientObj.id);
			tsl_clients[i].ip = tslClientObj.ip;
			tsl_clients[i].port = tslClientObj.port;
			tsl_clients[i].transport = tslClientObj.transport;
			setTimeout(StartTSLClientConnection, 5000, tsl_clients[i].id); //opens the port again after 5 seconds to give the old port time to close
			break;
		}
	}

	logger(`TSL Client Edited: ${tslClientObj.ip}:${tslClientObj.port} (${tslClientObj.transport})`, 'info');

	return {result: 'tsl-client-edited-successfully'};
}

function TallyArbiter_Delete_TSL_Client(obj) {
	let tslClientObj = GetTSLClientById(obj.tslClientId);
	let tslClientId = obj.tslClientId;

	for (let i = 0; i < tsl_clients.length; i++) {
		if (tsl_clients[i].id === tslClientId) {
			StopTSLClientConnection(tslClientId);
			tsl_clients.splice(i, 1);
		}
	}

	logger(`TSL Client Deleted: ${tslClientObj.ip}:${tslClientObj.port} (${tslClientObj.transport})`, 'info');

	return {result: 'tsl-client-deleted-successfully'};
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

function GetTSLClientById(tslClientId) {
	//gets the TSL Client by the Id
	return tsl_clients.find( ({ id }) => id === tslClientId);	
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
	io.to('producer').emit('clients', Clients);

	return clientObj.id;
}

function DeactivateClient(socketId) {
	for (let i = 0; i < Clients.length; i++) {
		if (Clients[i].socketId === socketId) {
			Clients[i].inactive = true;
			Clients[i].datetime_inactive = new Date().getTime();
		}
	}

	io.to('settings').emit('clients', Clients);
	io.to('producer').emit('clients', Clients);
}

function DeleteInactiveClients() {
	let changesMade = false;
	for (let i = Clients.length - 1; i >= 0; i--) {
		if (Clients[i].inactive === true) {
			let dtNow = new Date().getTime();
			if ((dtNow - Clients[i].datetime_inactive) > (1000 * 60 * 60)) { //1 hour
				logger(`Inactive Client removed: ${Clients[i].id}`, 'info');
				Clients.splice(i, 1);
				changesMade = true;
			}
		}
	}

	if (changesMade) {
		io.to('settings').emit('clients', Clients);
		io.to('producer').emit('clients', Clients);
	}

	setTimeout(DeleteInactiveClients, 5 * 1000); // runs every 5 minutes
}

function FlashClient(clientId) {
	let clientObj = Clients.find( ({ id }) => id === clientId);

	if (clientObj) {
		if (clientObj.relayGroupId) {
			io.to(clientObj.socketId).emit('flash', Clients[i].relayGroupId);
		}
		else if (clientObj.gpoGroupId) {
			io.to(clientObj.socketId).emit('flash', Clients[i].gpoGroupId);
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

function AddPort(port, sourceId) { //Adds the port to the list of reserved or in-use ports
	let portObj = {};
	portObj.port = port;
	portObj.sourceId = sourceId;
	PortsInUse.push(portObj);
	io.to('settings').emit('PortsInUse', PortsInUse);
}

function DeletePort(port) { //Deletes the port from the list of reserved or in-use ports
	for (let i = 0; i < PortsInUse.length; i++) {
		if (PortsInUse[i].port === port.toString()) {
			PortsInUse.splice(i, 1);
			break;
		}
	}
	io.to('settings').emit('PortsInUse', PortsInUse);
}

startUp();