/* Tally Arbiter */

//Protocol, Network, Socket, Server libraries/variables
const net 			= require('net');
const packet 		= require('packet');
const TSLUMD 		= require('tsl-umd'); // TSL UDP package
const dgram 		= require('dgram');
const { Atem }		= require('atem-connection');
const OBS 			= require('obs-websocket-js');
const fs 			= require('fs');
const path 			= require('path');
const {version} 	= require('./package.json');
const isPi 			= require('detect-rpi');
const clc 			= require('cli-color');
const util 			= require ('util');
const express 		= require('express');
const bodyParser 	= require('body-parser');
const axios 		= require('axios');
const http 			= require('http');
const socketio		= require('socket.io');
const ioClient		= require('socket.io-client');
const osc 			= require('osc');
const xml2js		= require('xml2js');
const jspack 		= require('jspack').jspack;

//Tally Arbiter variables
const listenPort 	= process.env.PORT || 4455;
const app 			= express();
const httpServer	= http.Server(app);
const io 			= socketio(httpServer);
const appProducer	= require('express').Router();
const appSettings	= require('express').Router();
var username_producer = 'producer';
var password_producer = '12345';
var username_settings = 'admin';
var password_settings = '12345';
const socketupdates_Settings  = ['sources', 'devices', 'device_sources', 'device_states', 'listener_clients', 'tsl_clients', 'cloud_destinations', 'cloud_keys', 'cloud_clients', 'PortsInUse'];
const socketupdates_Producer  = ['sources', 'devices', 'device_sources', 'device_states', 'listener_clients'];
const socketupdates_Companion = ['sources', 'devices', 'device_sources', 'device_states', 'listener_clients', 'tsl_clients', 'cloud_destinations'];
const oscPort 		= 5958;
var oscUDP			= null;
var vmix_emulator	= null; //TCP server for VMix Emulator
var vmix_clients 	= []; //Clients currently connected to the VMix Emulator
const config_file 	= './config.json'; //local storage JSON file
var listener_clients = []; //array of connected listener clients (web, python, relay, etc.)
var Logs 			= []; //array of actions, information, and errors
var tallydata_ATEM 	= []; //array of ATEM sources and current tally data
var labels_VideoHub = []; //array of VideoHub source labels
var destinations_VideoHub = []; //array of VideoHub destination/source assignments
var tallydata_VideoHub = []; //array of VideoHub sources and current tally data
var tallydata_OBS 	= []; //array of OBS sources and current tally data
var tallydata_RossCarbonite = []; //array of Ross Carbonite sources and current tally data by bus
var tallydata_VMix 	= []; //array of VMix sources and current tally data
var tallydata_TC 	= []; //array of Tricaster sources and current tally data
var tallydata_AWLivecore 	= []; //array of Analog Way sources and current tally data
var PortsInUse		= []; //array of UDP/TCP ports in use, includes reserved ports
var tsl_clients		= []; //array of TSL 3.1 clients that Tally Arbiter will send tally data to
var tsl_clients_sockets = []; //array of actual socket connections
var tsl_clients_1secupdate = false;
var tsl_clients_interval = null;
var cloud_destinations	= []; //array of Tally Arbiter Cloud Destinations (host, port, key)
var cloud_destinations_sockets = []; //array of actual socket connections
var cloud_keys 			= []; //array of Tally Arbiter Cloud Sources (key only)
var cloud_clients		= []; //array of Tally Arbiter Cloud Clients that have connected with a key

var source_reconnects	= []; //array of sources and their reconnect timers/intervals

var TestMode = false; //if the system is in test mode or not

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

portObj = {};
portObj.port = 80; //Default HTTP Port
portObj.sourceId = 'reserved';
PortsInUse.push(portObj);

portObj = {};
portObj.port = 443; //Default HTTPS Port
portObj.sourceId = 'reserved';
PortsInUse.push(portObj);

var source_types 	= [ //available tally source types
	{ id: '5e0a1d8c', label: 'TSL 3.1 UDP', type: 'tsl_31_udp', enabled: true, help: ''},
	{ id: 'dc75100e', label: 'TSL 3.1 TCP', type: 'tsl_31_tcp', enabled: true , help: ''},
	{ id: '54237da7', label: 'TSL 5.0 UDP', type: 'tsl_5_udp', enabled: true, help: ''},
	{ id: '560d3065', label: 'TSL 5.0 TCP', type: 'tsl_5_tcp', enabled: true , help: ''},
	{ id: '44b8bc4f', label: 'Blackmagic ATEM', type: 'atem', enabled: true, help: 'Uses Port 9910.' },
	{ id: '627a5902', label: 'Blackmagic VideoHub', type: 'videohub', enabled: true, help: 'Uses Port 9990.' },
	{ id: '4eb73542', label: 'OBS Studio', type: 'obs', enabled: true, help: 'The OBS Websocket plugin must be installed on the source.'},
	{ id: '58b6af42', label: 'VMix', type: 'vmix', enabled: true, help: 'Uses Port 8099.'},
	{ id: '4a58f00f', label: 'Roland Smart Tally', type: 'roland', enabled: true, help: ''},
	{ id: '1190d7be', label: 'Roland VR-50HD-MKII', type: 'roland-vr', enabled: true, help: 'Uses Port 8023'},
	{ id: '039bb9d6', label: 'Ross Carbonite', type: 'ross_carbonite', enabled: true, help: ''},
	{ id: 'e1c46de9', label: 'Ross Carbonite Black Solo', type: 'ross_carbonite', enabled: true, help: ''},
	{ id: '63d7ebc6', label: 'Ross Graphite', type: 'ross_carbonite', enabled: true, help: ''},
	{ id: '22d507ab', label: 'Ross Carbonite Black SD/HD', type: 'ross_carbonite', enabled: true, help: ''},
	{ id: '7da3b524', label: 'Ross Carbonite Ultra', type: 'ross_carbonite', enabled: true, help: ''},
	{ id: 'f2b7dc72', label: 'Newtek Tricaster', type: 'tc', enabled: true, help: 'Uses Port 5951.'},
	{ id: '05d6bce1', label: 'Open Sound Control (OSC)', type: 'osc', enabled: true, help: ''},
	{ id: 'cf51e3c9', label: 'Incoming Webhook', type: 'webhook', enabled: false, help: ''},
	{ id: 'a378e29d', label: 'Analog Way Livecore', type: 'awlivecore', enabled: true, help: 'Standard port is 10600. Source addresses are the input number.'},
	{ id: 'TESTMODE', label: 'Internal Test Mode', type: 'testmode', enabled: false, help: 'Used for Test Mode functionality.'}
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
	{ sourceTypeId: '54237da7', fields: [ //TSL 5.0 UDP
		{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' }
		]
	},
	{ sourceTypeId: '560d3065', fields: [ //TSL 5.0 TCP
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' }
		]
	},
	{ sourceTypeId: '44b8bc4f', fields: [ //Blackmagic ATEM
			{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
			{ fieldName: 'me_onair', fieldLabel: 'MEs to monitor', fieldType: 'multiselect',
				options: [
					{ id: '1', label: 'ME 1' },
					{ id: '2', label: 'ME 2' },
					{ id: '3', label: 'ME 3' },
					{ id: '4', label: 'ME 4' },
					{ id: '5', label: 'ME 5' },
					{ id: '6', label: 'ME 6' }
				]
			}
		]
	},
	{ sourceTypeId: '627a5902', fields: [ //Blackmagic VideoHub
			{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
			{ fieldName: 'destinations_pvw', fieldLabel: 'Destinations to monitor as PVW', fieldType: 'text'},
			{ fieldName: 'destinations_pgm', fieldLabel: 'Destinations to monitor as PGM', fieldType: 'text'}
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
	{ sourceTypeId: '1190d7be', fields: [ // Roland VR-50HD-MKII
			{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' }
		]
	},
	{ sourceTypeId: '039bb9d6', fields: [ //Ross Carbonite
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
			{ fieldName: 'transport_type', fieldLabel: 'Transport Type', fieldType: 'dropdown',
			options: [
				{ id: 'udp', label: 'UDP'},
				{ id: 'tcp', label: 'TCP'}
			] }
		]
	},
	{ sourceTypeId: 'e1c46de9', fields: [ //Ross Carbonite Black Solo
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
			{ fieldName: 'transport_type', fieldLabel: 'Transport Type', fieldType: 'dropdown',
			options: [
				{ id: 'udp', label: 'UDP'},
				{ id: 'tcp', label: 'TCP'}
			] }
		]
	},
	{ sourceTypeId: '63d7ebc6', fields: [ //Ross Graphite
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
			{ fieldName: 'transport_type', fieldLabel: 'Transport Type', fieldType: 'dropdown',
			options: [
				{ id: 'udp', label: 'UDP'},
				{ id: 'tcp', label: 'TCP'}
			] }
		]
	},
	{ sourceTypeId: '22d507ab', fields: [ //Ross Carbonite Black SD/HD
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
			{ fieldName: 'transport_type', fieldLabel: 'Transport Type', fieldType: 'dropdown',
			options: [
				{ id: 'udp', label: 'UDP'},
				{ id: 'tcp', label: 'TCP'}
			] }
		]
	},
	{ sourceTypeId: '7da3b524', fields: [ //Ross Carbonite Ultra
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
			{ fieldName: 'transport_type', fieldLabel: 'Transport Type', fieldType: 'dropdown',
			options: [
				{ id: 'udp', label: 'UDP'},
				{ id: 'tcp', label: 'TCP'}
			] }
		]
	},
	{ sourceTypeId: '05d6bce1', fields: [ // OSC Listener
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
			{ fieldName: 'info', fieldLabel: 'Information', text: 'The device source address should be sent as an integer or a string to the server\'s IP address on the specified port. Sending to /tally/preview_on designates it as a Preview command, and /tally/program_on designates it as a Program command. Sending /tally/previewprogram_on and /tally/previewprogram_off will send both bus states at the same time. To turn off a preview or program, use preview_off and program_off. The first OSC argument received will be used for the device source address.', fieldType: 'info' }
		]
	},
	{ sourceTypeId: 'f2b7dc72', fields: [ // Newtek Tricaster
			{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' }
		]
	},
	{ sourceTypeId: 'cf51e3c9', fields: [ //Incoming Webhook
			{ fieldName: 'path', fieldLabel: 'Webhook path', fieldType: 'text' }
		]
	},
	{ sourceTypeId: 'a378e29d', fields: [ //Analog Way Livecore
			{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' }
		]
	},
	{ sourceTypeId: 'TESTMODE', fields: [ //Internal Test Mode
			{ fieldName: 'info', fieldLabel: 'Information', text: 'This source generates preview/program tally data for the purposes of testing equipment.', fieldType: 'info' }
		]
	}
];

var source_types_busoptions = [
	{ sourceTypeId: '039bb9d6', busses: [ //Ross Carbonite
			{ bus: 'onair', name: 'Follow OnAir Setting' },
			{ bus: 'me1', name: 'ME 1' },
			{ bus: 'me2', name: 'ME 2' },
			{ bus: 'me3', name: 'ME 3' },
			{ bus: 'mme1', name: 'MiniME 1' },
			{ bus: 'mme2', name: 'MiniME 2' },
			{ bus: 'mme3', name: 'MiniME 3' },
			{ bus: 'mme4', name: 'MiniME 4' },
			{ bus: 'aux1', name: 'Aux 1' },
			{ bus: 'aux2', name: 'Aux 2' },
			{ bus: 'aux3', name: 'Aux 3' },
			{ bus: 'aux4', name: 'Aux 4' },
			{ bus: 'aux5', name: 'Aux 5' },
			{ bus: 'aux6', name: 'Aux 6' },
			{ bus: 'aux7', name: 'Aux 7' },
			{ bus: 'aux8', name: 'Aux 8' }
		]
	},
	{ sourceTypeId: 'e1c46de9', busses: [ //Ross Carbonite Black Solo
			{ bus: 'onair', name: 'Follow OnAir Setting' },
			{ bus: 'me1', name: 'ME 1' },
			{ bus: 'aux1', name: 'Aux 1' },
			{ bus: 'aux2', name: 'Aux 2' },
			{ bus: 'aux3', name: 'Aux 3' },
			{ bus: 'aux4', name: 'Aux 4' },
			{ bus: 'aux5', name: 'Aux 5' },
			{ bus: 'aux6', name: 'Aux 6' },
			{ bus: 'aux7', name: 'Aux 7' },
			{ bus: 'aux8', name: 'Aux 8' },
			{ bus: 'aux9', name: 'Aux 9' },
			{ bus: 'au10', name: 'Aux 10' },
			{ bus: 'aux11', name: 'Aux 11' },
			{ bus: 'aux12', name: 'Aux 12' },
			{ bus: 'aux13', name: 'Aux 13' },
			{ bus: 'aux14', name: 'Aux 14' },
			{ bus: 'aux15', name: 'Aux 15' },
			{ bus: 'aux16', name: 'Aux 16' }
		]
	},
	{ sourceTypeId: '63d7ebc6', busses: [ //Ross Graphite
			{ bus: 'onair', name: 'Follow OnAir Setting' },
			{ bus: 'me1', name: 'ME 1' },
			{ bus: 'me2', name: 'ME 2' },
			{ bus: 'mme1', name: 'MiniME 1' },
			{ bus: 'mme2', name: 'MiniME 2' },
			{ bus: 'mme3', name: 'MiniME 3' },
			{ bus: 'mme4', name: 'MiniME 4' },
			{ bus: 'aux1', name: 'Aux 1' },
			{ bus: 'aux2', name: 'Aux 2' },
			{ bus: 'aux3', name: 'Aux 3' },
			{ bus: 'aux4', name: 'Aux 4' },
			{ bus: 'aux5', name: 'Aux 5' },
			{ bus: 'aux6', name: 'Aux 6' },
			{ bus: 'aux7', name: 'Aux 7' },
			{ bus: 'aux8', name: 'Aux 8' },
			{ bus: 'aux9', name: 'Aux 9' },
			{ bus: 'au10', name: 'Aux 10' },
			{ bus: 'aux11', name: 'Aux 11' },
			{ bus: 'aux12', name: 'Aux 12' },
			{ bus: 'aux13', name: 'Aux 13' },
			{ bus: 'aux14', name: 'Aux 14' },
			{ bus: 'aux15', name: 'Aux 15' },
			{ bus: 'aux16', name: 'Aux 16' },
			{ bus: 'aux17', name: 'Aux 17' },
			{ bus: 'aux18', name: 'Aux 18' },
			{ bus: 'aux19', name: 'Aux 19' },
			{ bus: 'aux20', name: 'Aux 20' }
		]
	},
	{ sourceTypeId: '22d507ab', busses: [ //Ross Carbonite Black SD/HD
			{ bus: 'onair', name: 'Follow OnAir Setting' },
			{ bus: 'me1', name: 'ME 1' },
			{ bus: 'me2', name: 'ME 2' },
			{ bus: 'me3', name: 'ME 3' },
			{ bus: 'mme1', name: 'MiniME 1' },
			{ bus: 'mme2', name: 'MiniME 2' },
			{ bus: 'mme3', name: 'MiniME 3' },
			{ bus: 'mme4', name: 'MiniME 4' },
			{ bus: 'aux1', name: 'Aux 1' },
			{ bus: 'aux2', name: 'Aux 2' },
			{ bus: 'aux3', name: 'Aux 3' },
			{ bus: 'aux4', name: 'Aux 4' },
			{ bus: 'aux5', name: 'Aux 5' },
			{ bus: 'aux6', name: 'Aux 6' },
			{ bus: 'aux7', name: 'Aux 7' },
			{ bus: 'aux8', name: 'Aux 8' },
			{ bus: 'aux9', name: 'Aux 9' },
			{ bus: 'au10', name: 'Aux 10' },
			{ bus: 'aux11', name: 'Aux 11' },
			{ bus: 'aux12', name: 'Aux 12' },
			{ bus: 'aux13', name: 'Aux 13' },
			{ bus: 'aux14', name: 'Aux 14' },
			{ bus: 'aux15', name: 'Aux 15' },
			{ bus: 'aux16', name: 'Aux 16' },
			{ bus: 'aux17', name: 'Aux 17' },
			{ bus: 'aux18', name: 'Aux 18' },
			{ bus: 'aux19', name: 'Aux 19' },
			{ bus: 'aux20', name: 'Aux 20' }
		]
	},
	{ sourceTypeId: '7da3b524', busses: [ //Ross Carbonite Ultra
		{ bus: 'onair', name: 'Follow OnAir Setting' },
		{ bus: 'mepp', name: 'ME P/P' },
		{ bus: 'me1', name: 'ME 1' },
		{ bus: 'me2', name: 'ME 2' },
		{ bus: 'mme1', name: 'MiniME 1' },
		{ bus: 'mme2', name: 'MiniME 2' },
		{ bus: 'mme3', name: 'MiniME 3' },
		{ bus: 'mme4', name: 'MiniME 4' },
		{ bus: 'aux1', name: 'Aux 1' },
		{ bus: 'aux2', name: 'Aux 2' },
		{ bus: 'aux3', name: 'Aux 3' },
		{ bus: 'aux4', name: 'Aux 4' },
		{ bus: 'aux5', name: 'Aux 5' },
		{ bus: 'aux6', name: 'Aux 6' },
		{ bus: 'aux7', name: 'Aux 7' },
		{ bus: 'aux8', name: 'Aux 8' },
		{ bus: 'aux9', name: 'Aux 9' },
		{ bus: 'au10', name: 'Aux 10' },
		{ bus: 'aux11', name: 'Aux 11' },
		{ bus: 'aux12', name: 'Aux 12' },
		{ bus: 'aux13', name: 'Aux 13' },
		{ bus: 'aux14', name: 'Aux 14' },
		{ bus: 'aux15', name: 'Aux 15' },
		{ bus: 'aux16', name: 'Aux 16' },
		{ bus: 'aux17', name: 'Aux 17' },
		{ bus: 'aux18', name: 'Aux 18' },
		{ bus: 'aux19', name: 'Aux 19' },
		{ bus: 'aux20', name: 'Aux 20' },
		{ bus: 'aux21', name: 'Aux 21' },
		{ bus: 'aux22', name: 'Aux 22' },
		{ bus: 'aux23', name: 'Aux 23' },
		{ bus: 'aux24', name: 'Aux 24' },
		{ bus: 'aux25', name: 'Aux 25' },
		{ bus: 'aux26', name: 'Aux 26' },
		{ bus: 'aux27', name: 'Aux 27' }
	]
},
];

var source_types_busaddresses = [
	//Ross Carbonite
	{ sourceTypeId: '039bb9d6', address: 'onair_program', bus: 'onair', label: "OnAir Program", type: "program" },
	{ sourceTypeId: '039bb9d6', address: 'onair_preview', bus: 'onair', label: "OnAir Preview", type: "preview"},
	{ sourceTypeId: '039bb9d6', address: '25', bus: 'me1', label: "ME 1 BKGD", type: "program"},
	{ sourceTypeId: '039bb9d6', address: '26', bus: 'me1', label: "ME 1 PST", type: "preview"},
	{ sourceTypeId: '039bb9d6', address: '35', bus: 'me2', label: "ME 2 BKGD", type: "program"},
	{ sourceTypeId: '039bb9d6', address: '36', bus: 'me2', label: "ME 2 PST", type: "preview"},
	{ sourceTypeId: '039bb9d6', address: '45', bus: 'me3', label: "ME 3 BKGD", type: "program"},
	{ sourceTypeId: '039bb9d6', address: '46', bus: 'me3', label: "ME 3 PST", type: "preview"},
	{ sourceTypeId: '039bb9d6', address: '65', bus: 'aux1', label: "Aux 1", type: "program"},
	{ sourceTypeId: '039bb9d6', address: '66', bus: 'aux2', label: "Aux 2", type: "program"},
	{ sourceTypeId: '039bb9d6', address: '67', bus: 'aux3', label: "Aux 3", type: "program"},
	{ sourceTypeId: '039bb9d6', address: '68', bus: 'aux4', label: "Aux 4", type: "program"},
	{ sourceTypeId: '039bb9d6', address: '69', bus: 'aux5', label: "Aux 5", type: "program"},
	{ sourceTypeId: '039bb9d6', address: '70', bus: 'aux6', label: "Aux 6", type: "program"},
	{ sourceTypeId: '039bb9d6', address: '71', bus: 'aux7', label: "Aux 7", type: "program"},
	{ sourceTypeId: '039bb9d6', address: '72', bus: 'aux8', label: "Aux 8", type: "program"},
	{ sourceTypeId: '039bb9d6', address: '81', bus: 'mme1', label: "MiniME™ 1 BKGD", type: "program"},
	{ sourceTypeId: '039bb9d6', address: '82', bus: 'mme1', label: "MiniME™ 1 PST", type: "preview"},
	{ sourceTypeId: '039bb9d6', address: '86', bus: 'mme2', label: "MiniME™ 2 BKGD", type: "program"},
	{ sourceTypeId: '039bb9d6', address: '87', bus: 'mme2', label: "MiniME™ 2 PST", type: "preview"},
	{ sourceTypeId: '039bb9d6', address: '91', bus: 'mme3', label: "MiniME™ 3 BKGD", type: "program"},
	{ sourceTypeId: '039bb9d6', address: '92', bus: 'mme3', label: "MiniME™ 3 PST", type: "preview"},
	{ sourceTypeId: '039bb9d6', address: '96', bus: 'mme4', label: "MiniME™ 4 BKGD", type: "program"},
	{ sourceTypeId: '039bb9d6', address: '97', bus: 'mme4', label: "MiniME™ 4 PST", type: "preview"},
	////////

	//Ross Carbonite Black Solo
	{ sourceTypeId: 'e1c46de9', address: 'onair_program', bus: 'onair', label: "OnAir Program", type: "program" },
	{ sourceTypeId: 'e1c46de9', address: 'onair_preview', bus: 'onair', label: "OnAir Preview", type: "preview"},
	{ sourceTypeId: 'e1c46de9', address: '37', bus: 'me1', label: "ME 1 BKGD", type: "program"},
	{ sourceTypeId: 'e1c46de9', address: '38', bus: 'me1', label: "ME 1 PST", type: "preview"},
	{ sourceTypeId: 'e1c46de9', address: '67', bus: 'aux1', label: "Aux 1", type: "program"},
	{ sourceTypeId: 'e1c46de9', address: '68', bus: 'aux2', label: "Aux 2", type: "program"},
	{ sourceTypeId: 'e1c46de9', address: '69', bus: 'aux3', label: "Aux 3", type: "program"},
	{ sourceTypeId: 'e1c46de9', address: '70', bus: 'aux4', label: "Aux 4", type: "program"},
	{ sourceTypeId: 'e1c46de9', address: '71', bus: 'aux5', label: "Aux 5", type: "program"},
	{ sourceTypeId: 'e1c46de9', address: '72', bus: 'aux6', label: "Aux 6", type: "program"},
	{ sourceTypeId: 'e1c46de9', address: '73', bus: 'aux7', label: "Aux 7", type: "program"},
	{ sourceTypeId: 'e1c46de9', address: '74', bus: 'aux8', label: "Aux 8", type: "program"},
	{ sourceTypeId: 'e1c46de9', address: '75', bus: 'aux9', label: "Aux 9", type: "program"},
	{ sourceTypeId: 'e1c46de9', address: '76', bus: 'aux10', label: "Aux 10", type: "program"},
	{ sourceTypeId: 'e1c46de9', address: '77', bus: 'aux11', label: "Aux 11", type: "program"},
	{ sourceTypeId: 'e1c46de9', address: '78', bus: 'aux12', label: "Aux 12", type: "program"},
	{ sourceTypeId: 'e1c46de9', address: '79', bus: 'aux13', label: "Aux 13", type: "program"},
	{ sourceTypeId: 'e1c46de9', address: '80', bus: 'aux14', label: "Aux 14", type: "program"},
	{ sourceTypeId: 'e1c46de9', address: '81', bus: 'aux15', label: "Aux 15", type: "program"},
	{ sourceTypeId: 'e1c46de9', address: '82', bus: 'aux16', label: "Aux 16", type: "program"},

	//Ross Graphite
	{ sourceTypeId: '63d7ebc6', address: 'onair_program', bus: 'onair', label: "OnAir Program", type: "program" },
	{ sourceTypeId: '63d7ebc6', address: 'onair_preview', bus: 'onair', label: "OnAir Preview", type: "preview"},
	{ sourceTypeId: '63d7ebc6', address: '37', bus: 'me1', label: "ME 1 BKGD", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '38', bus: 'me1', label: "ME 1 PST", type: "preview"},
	{ sourceTypeId: '63d7ebc6', address: '47', bus: 'me2', label: "ME 2 BKGD", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '48', bus: 'me2', label: "ME 2 PST", type: "preview"},
	{ sourceTypeId: '63d7ebc6', address: '67', bus: 'aux1', label: "Aux 1", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '68', bus: 'aux2', label: "Aux 2", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '69', bus: 'aux3', label: "Aux 3", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '70', bus: 'aux4', label: "Aux 4", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '71', bus: 'aux5', label: "Aux 5", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '72', bus: 'aux6', label: "Aux 6", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '73', bus: 'aux7', label: "Aux 7", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '74', bus: 'aux8', label: "Aux 8", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '75', bus: 'aux9', label: "Aux 9", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '76', bus: 'aux10', label: "Aux 10", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '77', bus: 'aux11', label: "Aux 11", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '78', bus: 'aux12', label: "Aux 12", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '79', bus: 'aux13', label: "Aux 13", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '80', bus: 'aux14', label: "Aux 14", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '81', bus: 'aux15', label: "Aux 15", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '82', bus: 'aux16', label: "Aux 16", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '83', bus: 'aux17', label: "Aux 17", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '84', bus: 'aux18', label: "Aux 18", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '85', bus: 'aux19', label: "Aux 19", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '86', bus: 'aux20', label: "Aux 20", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '87', bus: 'mme1', label: "MiniME™ 1 BKGD", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '98', bus: 'mme1', label: "MiniME™ 1 PST", type: "preview"},
	{ sourceTypeId: '63d7ebc6', address: '91', bus: 'mme2', label: "MiniME™ 2 BKGD", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '92', bus: 'mme2', label: "MiniME™ 2 PST", type: "preview"},
	{ sourceTypeId: '63d7ebc6', address: '95', bus: 'mme3', label: "MiniME™ 3 BKGD", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '96', bus: 'mme3', label: "MiniME™ 3 PST", type: "preview"},
	{ sourceTypeId: '63d7ebc6', address: '105', bus: 'mme4', label: "MiniME™ 4 BKGD", type: "program"},
	{ sourceTypeId: '63d7ebc6', address: '106', bus: 'mme4', label: "MiniME™ 4 PST", type: "preview"},
	////////

	//Ross Carbonite Black SD/HD
	{ sourceTypeId: '22d507ab', address: 'onair_program', bus: 'onair', label: "OnAir Program", type: "program" },
	{ sourceTypeId: '22d507ab', address: 'onair_preview', bus: 'onair', label: "OnAir Preview", type: "preview"},
	{ sourceTypeId: '22d507ab', address: '37', bus: 'me1', label: "ME 1 BKGD", type: "program"},
	{ sourceTypeId: '22d507ab', address: '38', bus: 'me1', label: "ME 1 PST", type: "preview"},
	{ sourceTypeId: '22d507ab', address: '47', bus: 'me2', label: "ME 2 BKGD", type: "program"},
	{ sourceTypeId: '22d507ab', address: '48', bus: 'me2', label: "ME 2 PST", type: "preview"},
	{ sourceTypeId: '22d507ab', address: '57', bus: 'me3', label: "ME 3 BKGD", type: "program"},
	{ sourceTypeId: '22d507ab', address: '58', bus: 'me3', label: "ME 3 PST", type: "preview"},
	{ sourceTypeId: '22d507ab', address: '67', bus: 'aux1', label: "Aux 1", type: "program"},
	{ sourceTypeId: '22d507ab', address: '68', bus: 'aux2', label: "Aux 2", type: "program"},
	{ sourceTypeId: '22d507ab', address: '69', bus: 'aux3', label: "Aux 3", type: "program"},
	{ sourceTypeId: '22d507ab', address: '70', bus: 'aux4', label: "Aux 4", type: "program"},
	{ sourceTypeId: '22d507ab', address: '71', bus: 'aux5', label: "Aux 5", type: "program"},
	{ sourceTypeId: '22d507ab', address: '72', bus: 'aux6', label: "Aux 6", type: "program"},
	{ sourceTypeId: '22d507ab', address: '73', bus: 'aux7', label: "Aux 7", type: "program"},
	{ sourceTypeId: '22d507ab', address: '74', bus: 'aux8', label: "Aux 8", type: "program"},
	{ sourceTypeId: '22d507ab', address: '75', bus: 'aux9', label: "Aux 9", type: "program"},
	{ sourceTypeId: '22d507ab', address: '76', bus: 'aux10', label: "Aux 10", type: "program"},
	{ sourceTypeId: '22d507ab', address: '77', bus: 'aux11', label: "Aux 11", type: "program"},
	{ sourceTypeId: '22d507ab', address: '78', bus: 'aux12', label: "Aux 12", type: "program"},
	{ sourceTypeId: '22d507ab', address: '79', bus: 'aux13', label: "Aux 13", type: "program"},
	{ sourceTypeId: '22d507ab', address: '80', bus: 'aux14', label: "Aux 14", type: "program"},
	{ sourceTypeId: '22d507ab', address: '81', bus: 'aux15', label: "Aux 15", type: "program"},
	{ sourceTypeId: '22d507ab', address: '82', bus: 'aux16', label: "Aux 16", type: "program"},
	{ sourceTypeId: '22d507ab', address: '83', bus: 'aux17', label: "Aux 17", type: "program"},
	{ sourceTypeId: '22d507ab', address: '84', bus: 'aux18', label: "Aux 18", type: "program"},
	{ sourceTypeId: '22d507ab', address: '85', bus: 'aux19', label: "Aux 19", type: "program"},
	{ sourceTypeId: '22d507ab', address: '86', bus: 'aux20', label: "Aux 20", type: "program"},
	{ sourceTypeId: '22d507ab', address: '87', bus: 'mme1', label: "MiniME™ 1 BKGD", type: "program"},
	{ sourceTypeId: '22d507ab', address: '88', bus: 'mme1', label: "MiniME™ 1 PST", type: "preview"},
	{ sourceTypeId: '22d507ab', address: '91', bus: 'mme2', label: "MiniME™ 2 BKGD", type: "program"},
	{ sourceTypeId: '22d507ab', address: '92', bus: 'mme2', label: "MiniME™ 2 PST", type: "preview"},
	{ sourceTypeId: '22d507ab', address: '95', bus: 'mme3', label: "MiniME™ 3 BKGD", type: "program"},
	{ sourceTypeId: '22d507ab', address: '96', bus: 'mme3', label: "MiniME™ 3 PST", type: "preview"},
	{ sourceTypeId: '22d507ab', address: '105', bus: 'mme4', label: "MiniME™ 4 BKGD", type: "program"},
	{ sourceTypeId: '22d507ab', address: '106', bus: 'mme4', label: "MiniME™ 4 PST", type: "preview"},
	////////

	//Ross Carbonite Ultra
	{ sourceTypeId: '7da3b524', address: 'onair_program', bus: 'onair', label: "OnAir Program", type: "program" },
	{ sourceTypeId: '7da3b524', address: 'onair_preview', bus: 'onair', label: "OnAir Preview", type: "preview"},
	{ sourceTypeId: '7da3b524', address: '25', bus: 'mepp', label: "ME P/P BKGD", type: "program"},
	{ sourceTypeId: '7da3b524', address: '26', bus: 'mepp', label: "ME P/P PST", type: "preview"},
	{ sourceTypeId: '7da3b524', address: '35', bus: 'me1', label: "ME 1 BKGD", type: "program"},
	{ sourceTypeId: '7da3b524', address: '36', bus: 'me1', label: "ME 1 PST", type: "preview"},
	{ sourceTypeId: '7da3b524', address: '45', bus: 'me2', label: "ME 2 BKGD", type: "program"},
	{ sourceTypeId: '7da3b524', address: '46', bus: 'me2', label: "ME 2 PST", type: "preview"},
	{ sourceTypeId: '7da3b524', address: '64', bus: 'mme1', label: "MiniME™ 1 BKGD", type: "program"},
	{ sourceTypeId: '7da3b524', address: '65', bus: 'mme1', label: "MiniME™ 1 PST", type: "preview"},
	{ sourceTypeId: '7da3b524', address: '68', bus: 'mme2', label: "MiniME™ 2 BKGD", type: "program"},
	{ sourceTypeId: '7da3b524', address: '69', bus: 'mme2', label: "MiniME™ 2 PST", type: "preview"},
	{ sourceTypeId: '7da3b524', address: '72', bus: 'mme3', label: "MiniME™ 3 BKGD", type: "program"},
	{ sourceTypeId: '7da3b524', address: '73', bus: 'mme3', label: "MiniME™ 3 PST", type: "preview"},
	{ sourceTypeId: '7da3b524', address: '76', bus: 'mme4', label: "MiniME™ 4 BKGD", type: "program"},
	{ sourceTypeId: '7da3b524', address: '77', bus: 'mme4', label: "MiniME™ 4 PST", type: "preview"},
	{ sourceTypeId: '7da3b524', address: '100', bus: 'aux1', label: "Aux 1", type: "program"},
	{ sourceTypeId: '7da3b524', address: '101', bus: 'aux2', label: "Aux 2", type: "program"},
	{ sourceTypeId: '7da3b524', address: '102', bus: 'aux3', label: "Aux 3", type: "program"},
	{ sourceTypeId: '7da3b524', address: '103', bus: 'aux4', label: "Aux 4", type: "program"},
	{ sourceTypeId: '7da3b524', address: '104', bus: 'aux5', label: "Aux 5", type: "program"},
	{ sourceTypeId: '7da3b524', address: '105', bus: 'aux6', label: "Aux 6", type: "program"},
	{ sourceTypeId: '7da3b524', address: '106', bus: 'aux7', label: "Aux 7", type: "program"},
	{ sourceTypeId: '7da3b524', address: '107', bus: 'aux8', label: "Aux 8", type: "program"},
	{ sourceTypeId: '7da3b524', address: '108', bus: 'aux9', label: "Aux 9", type: "program"},
	{ sourceTypeId: '7da3b524', address: '109', bus: 'aux10', label: "Aux 10", type: "program"},
	{ sourceTypeId: '7da3b524', address: '110', bus: 'aux11', label: "Aux 11", type: "program"},
	{ sourceTypeId: '7da3b524', address: '111', bus: 'aux12', label: "Aux 12", type: "program"},
	{ sourceTypeId: '7da3b524', address: '112', bus: 'aux13', label: "Aux 13", type: "program"},
	{ sourceTypeId: '7da3b524', address: '113', bus: 'aux14', label: "Aux 14", type: "program"},
	{ sourceTypeId: '7da3b524', address: '114', bus: 'aux15', label: "Aux 15", type: "program"},
	{ sourceTypeId: '7da3b524', address: '115', bus: 'aux16', label: "Aux 16", type: "program"},
	{ sourceTypeId: '7da3b524', address: '116', bus: 'aux17', label: "Aux 17", type: "program"},
	{ sourceTypeId: '7da3b524', address: '117', bus: 'aux18', label: "Aux 18", type: "program"},
	{ sourceTypeId: '7da3b524', address: '118', bus: 'aux19', label: "Aux 19", type: "program"},
	{ sourceTypeId: '7da3b524', address: '119', bus: 'aux20', label: "Aux 20", type: "program"},
	{ sourceTypeId: '7da3b524', address: '120', bus: 'aux21', label: "Aux 21", type: "program"},
	{ sourceTypeId: '7da3b524', address: '121', bus: 'aux22', label: "Aux 22", type: "program"},
	{ sourceTypeId: '7da3b524', address: '122', bus: 'aux23', label: "Aux 23", type: "program"},
	{ sourceTypeId: '7da3b524', address: '123', bus: 'aux24', label: "Aux 24", type: "program"},
	{ sourceTypeId: '7da3b524', address: '124', bus: 'aux25', label: "Aux 25", type: "program"},
	{ sourceTypeId: '7da3b524', address: '125', bus: 'aux26', label: "Aux 26", type: "program"},
	{ sourceTypeId: '7da3b524', address: '126', bus: 'aux27', label: "Aux 27", type: "program"}
	////////
]

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
	{ id: '79e3ce27', label: 'Generic TCP', type: 'tcp', enabled: true},
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
			{ fieldName: 'protocol', fieldLabel: 'Protocol', fieldType: 'dropdown', options: [ { id: 'http://', label: 'HTTP' }, { id: 'https://', label: 'HTTPS'} ] },
			{ fieldName: 'ip', fieldLabel: 'IP Address/URL', fieldType: 'text' },
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
			{ fieldName: 'path', fieldLabel: 'Path', fieldType: 'text' },
			{ fieldName: 'method', fieldLabel: 'Method', fieldType: 'dropdown', options: [ { id: 'GET', label: 'GET' }, { id: 'POST', label: 'POST'} ] },
			{ fieldName: 'contentType', fieldLabel: 'Content-Type', fieldType: 'dropdown', options: [ { id: 'application/json', label: 'application/json' }, { id: 'application/xml', label: 'application/xml'}, { id: 'application/x-www-form-urlencoded', label: 'x-www-form-urlencoded'}, { id: 'text/plain', label: 'Text/Plain'}, { id: '', label: 'Default'} ] },
			{ fieldName: 'postdata', fieldLabel: 'POST Data', fieldType: 'text' }
		]
	},
	{ outputTypeId: '79e3ce27', fields: [ //Generic TCP
			{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
			{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
			{ fieldName: 'string', fieldLabel: 'TCP String', fieldType: 'text' },
			{ fieldName: 'end', fieldLabel: 'End Character', fieldType: 'dropdown', options: [{ id: '', label: 'None' }, { id: '\n', label: 'LF - \\n' }, { id: '\r\n', label: 'CRLF - \\r\\n' }, { id: '\r', label: 'CR - \\r' }, { id: '\x00', label: 'NULL - \\x00' }]}
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
	DeleteInactiveListenerClients();

	/*process.on('uncaughtException', function (err) {
		logger(`Caught exception: ${err}`, 'error');
	});*/
}

//sets up the REST API and GUI pages and starts the Express server that will listen for incoming requests
function initialSetup() {
	logger('Setting up the REST API.', 'info-quiet');

	app.use(bodyParser.json({ type: 'application/json' }));

	//about the author, this program, etc.
	app.get('/', function (req, res) {
		res.sendFile('views/index.html', { root: __dirname });
	});

	//gets the version of the software
	app.get('/version', function (req, res) {
		res.send(version);
	});

	//tally page - view tally state of any device
	app.get('/tally', function (req, res) {
		res.sendFile('views/tally.html', { root: __dirname });
	});

	appProducer.use((req, res, next) => {

		// -----------------------------------------------------------------------
		// authentication middleware

		// parse login and password from headers
		const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
		const [login, password] = new Buffer.from(b64auth, 'base64').toString().split(':');

		// Verify login and password are set and correct
		if (!login || !password || login !== username_producer || password !== password_producer) {
			res.set('WWW-Authenticate', 'Basic realm=\'401\''); // change this
			res.status(401).send('Authentication required to access this area.'); // custom message
			return;
		}

		// -----------------------------------------------------------------------
		// Access granted...
		next();
	});

	app.use('/producer', appProducer);

	//producer page - view tally states of all devices
	appProducer.get('/', function (req, res) {
		res.sendFile('views/producer.html', { root: __dirname });
	});

	appSettings.use((req, res, next) => {

		// -----------------------------------------------------------------------
		// authentication middleware

		// parse login and password from headers
		const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
		const [login, password] = new Buffer.from(b64auth, 'base64').toString().split(':');

		// Verify login and password are set and correct
		if (!login || !password || login !== username_settings || password !== password_settings) {
			res.set('WWW-Authenticate', 'Basic realm=\'401\''); // change this
			res.status(401).send('Authentication required to access this area.'); // custom message
			return;
		}

		// -----------------------------------------------------------------------
		// Access granted...
		next();
	});

	app.use('/settings', appSettings);

	//settings page - add sources, devices, actions, etc.
	appSettings.get('/', function (req, res) {
		res.sendFile('views/settings.html', { root: __dirname });
	});

	appSettings.get('/source_types', function (req, res) {
		//gets all Tally Source Types
		res.send(source_types);
	});

	appSettings.get('/source_types_datafields', function (req, res) {
		//gets all Tally Source Types Data Fields
		res.send(source_types_datafields);
	});

	appSettings.get('/source_types_busoptions', function (req, res) {
		//gets all Tally Source Types Bus Options
		res.send(source_types_busoptions);
	});

	appSettings.get('/output_types', function (req, res) {
		//gets all Tally Output Types
		res.send(output_types);
	});

	appSettings.get('/output_types_datafields', function (req, res) {
		//gets all Tally Output Types Data Fields
		res.send(output_types_datafields);
	});

	appSettings.get('/bus_options', function (req, res) {
		//gets all Tally Bus Options
		res.send(bus_options);
	});

	appSettings.get('/sources', function (req, res) {
		//gets all Tally Sources
		res.send(sources);
	});

	appSettings.get('/devices', function (req, res) {
		//gets all Tally Devices
		res.send(devices);
	});

	appSettings.get('/device_sources', function (req, res) {
		//gets all Tally Device Sources
		res.send(device_sources);
	});

	appSettings.get('/device_actions', function (req, res) {
		//gets all Tally Device Actions
		res.send(device_actions);
	});

	appSettings.get('/device_states', function (req, res) {
		//gets all Tally Device States
		res.send(device_states);
	});

	appSettings.get('/tsl_clients', function (req, res) {
		//gets all TSL Clients
		res.send(tsl_clients);
	});

	appSettings.get('/cloud_destinations', function (req, res) {
		//gets all Cloud Destinations
		res.send(cloud_destinations);
	});

	appSettings.get('/cloud_keys', function (req, res) {
		//gets all Cloud Keys
		res.send(cloud_keys);
	});

	appSettings.get('/cloud_clients', function (req, res) {
		//gets all Cloud Clients
		res.send(cloud_clients);
	});

	appSettings.get('/listener_clients', function (req, res) {
		//gets all Listener Clients
		res.send(listener_clients);
	});

	appSettings.get('/flash/:clientid', function (req, res) {
		//sends a flash command to the listener
		let clientId = req.params.clientid;
		let result = FlashListenerClient(clientId);
		res.send(result);
	});

	appSettings.post('/manage', function (req, res) {
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

		socket.on('sources', function() { // sends the configured Sources to the socket
			socket.emit('sources', sources);
		});

		socket.on('source_tallydata', function(sourceId) { //gets all Source Tally Data
			let source = GetSourceBySourceId(sourceId);
			let sourceType = GetSourceTypeBySourceTypeId(source.sourceTypeId);
			let result = false;
			
			//Note: results from all except OBS and Tricaster commented out as either no device currently in warehouse to test with and/or
			//the data structure of these objects seems to differ, perhaps a common structure for tally data objects would be good in the future
			//so it can be dealt with in the same manner elsewhere.
			
			switch(sourceType.type) {
				case 'atem': //Blackmagic ATEM
					//result = tallydata_ATEM;
					break;
				case 'videohub': //Blackmagic VideoHub
					result = tallydata_VideoHub;
					break;
				case 'obs': //OBS
					result = tallydata_OBS;
					break;
				case 'vmix': //VMix
					result = tallydata_VMix;
					break;
				case 'tricaster': //Tricaster
					result = tallydata_TC;
					break;
				case 'awlivecore': //Analog Way Livecore
					//result = tallydata_AWLivecore;
					break;
			}
			if (result !== false) {
				result = result.filter(tally => tally.sourceId == sourceId);
				socket.emit('source_tallydata', sourceId, result);
			}
			else {
				socket.emit('source_tallydata', sourceId, new Array());
			}
		});

		socket.on('devices', function() { // sends the configured Devices to the socket
			socket.emit('devices', devices);
		});

		socket.on('device_sources', function() { // sends the configured Device Sources to the socket
			socket.emit('device_sources', device_sources);
		});

		socket.on('device_actions', function() { // sends the configured Device Actions to the socket
			socket.emit('device_actions', device_actions);
		});

		socket.on('bus_options', function() { // sends the Bus Options (preview, program) to the socket
			socket.emit('bus_options', bus_options);
		});

		socket.on('device_listen', function(deviceId, listenerType) { // emitted by a socket (tally page) that has selected a Device to listen for state information
			let device = GetDeviceByDeviceId(deviceId);
			if ((deviceId === 'null') || (device.id === 'unassigned')) {
				if (devices.length > 0) {
					deviceId = devices[0].id;
				}
				else {
					deviceId = 'unassigned';
				}
			}

			socket.join('device-' + deviceId);
			if (listenerType === 'web') {
				socket.join('messaging');
			}
			let deviceName = GetDeviceByDeviceId(deviceId).name;
			logger(`Listener Client Connected. Type: ${listenerType} Device: ${deviceName}`, 'info');

			let ipAddress = socket.request.connection.remoteAddress;
			let datetimeConnected = new Date().getTime();

			let clientId = AddListenerClient(socket.id, deviceId, listenerType, ipAddress, datetimeConnected, true, true);
			socket.emit('device_states', GetDeviceStatesByDeviceId(deviceId));
		});

		socket.on('device_listen_blink', function(obj) { // emitted by the Python blink(1) client that has selected a Device to listen for state information
			let deviceId = obj.deviceId;
			let device = GetDeviceByDeviceId(deviceId);
			if ((deviceId === 'null') || (device.id === 'unassigned')) {
				if (devices.length > 0) {
					deviceId = devices[0].id;
				}
				else {
					deviceId = 'unassigned';
				}
			}

			let listenerType = 'blink(1)';

			socket.join('device-' + deviceId);
			let deviceName = GetDeviceByDeviceId(deviceId).name;
			logger(`Listener Client Connected. Type: ${listenerType} Device: ${deviceName}`, 'info');

			let ipAddress = socket.request.connection.remoteAddress;
			let datetimeConnected = new Date().getTime();

			let clientId = AddListenerClient(socket.id, deviceId, listenerType, ipAddress, datetimeConnected, true, true);
			socket.emit('device_states', GetDeviceStatesByDeviceId(deviceId));
		});

		socket.on('device_listen_relay', function(relayGroupId, deviceId) { // emitted by the Relay Controller accessory program that has selected a Device to listen for state information
			let device = GetDeviceByDeviceId(deviceId);
			if (device.id === 'unassigned') {
				if (devices.length > 0) {
					deviceId = devices[0].id;
				}
				else {
					deviceId = 'unassigned';
				}
			}

			let listenerType = 'relay';

			socket.join('device-' + deviceId);
			let deviceName = GetDeviceByDeviceId(deviceId).name;
			logger(`Listener Client Connected. Type: ${listenerType} Device: ${deviceName}`, 'info');

			let ipAddress = socket.request.connection.remoteAddress;
			let datetimeConnected = new Date().getTime();

			let clientId = AddListenerClient(socket.id, deviceId, listenerType, ipAddress, datetimeConnected, true, true);
			//add relayGroupId to client
			for (let i = 0; i < listener_clients.length; i++) {
				if (listener_clients[i].id === clientId) {
					listener_clients[i].relayGroupId = relayGroupId;
					break;
				}
			}
			socket.emit('listener_relay_assignment', relayGroupId, deviceId);
		});

		socket.on('device_listen_gpo', function(obj) { // emitted by the Python GPO Controller client that has selected a Device to listen for state information
			let gpoGroupId = obj.gpoGroupId;
			let deviceId = obj.deviceId;
			let device = GetDeviceByDeviceId(deviceId);
			if ((deviceId === 'null') || (device.id === 'unassigned')) {
				if (devices.length > 0) {
					deviceId = devices[0].id;
				}
				else {
					deviceId = 'unassigned';
				}
			}

			let listenerType = 'gpo';

			socket.join('device-' + deviceId);
			let deviceName = GetDeviceByDeviceId(deviceId).name;
			logger(`Listener Client Connected. Type: ${listenerType} Device: ${deviceName}`, 'info');

			let ipAddress = socket.request.connection.remoteAddress;
			let datetimeConnected = new Date().getTime();

			let clientId = AddListenerClient(socket.id, deviceId, listenerType, ipAddress, datetimeConnected, true, true);
			//add gpoGroupId to client
			for (let i = 0; i < listener_clients.length; i++) {
				if (listener_clients[i].id === clientId) {
					listener_clients[i].gpoGroupId = gpoGroupId;
					break;
				}
			}
			socket.emit('listener_relay_assignment', gpoGroupId, deviceId);
		});

		socket.on('device_listen_m5', function(obj) { // emitted by the M5 Arduino clients (Atom, Stick C, Stick C Plus, etc.) that has selected a Device to listen for state information
			let deviceId = obj.deviceId;
			let device = GetDeviceByDeviceId(deviceId);
			let listenerType = 'm5';
			
			if (devices.length > 0) {
				socket.emit('devices', devices);
			}

			if ((deviceId === 'null') || (device.id === 'unassigned')) {
				if (devices.length > 0) {
					deviceId = devices[0].id;
					socket.emit('deviceId', deviceId);
				}
				else {
					deviceId = 'unassigned';
				}
			}
			
			if (devices.length > 0) {
				socket.emit('device_states', GetDeviceStatesByDeviceId(deviceId));
			}
			
			if (obj.listenerType) {
				listenerType = obj.listenerType;
			}

			socket.join('device-' + deviceId);
			if (listenerType === 'm5-stickc') {
				socket.join('messaging');
			}
			let deviceName = GetDeviceByDeviceId(deviceId).name;
			logger(`Listener Client Connected. Type: ${listenerType} Device: ${deviceName} DeviceID: ${deviceId}`, 'info');

			let ipAddress = socket.request.connection.remoteAddress;
			let datetimeConnected = new Date().getTime();

			let clientId = AddListenerClient(socket.id, deviceId, listenerType, ipAddress, datetimeConnected, true, true);
		});

		socket.on('device_states', function(deviceId) {
			socket.emit('device_states', GetDeviceStatesByDeviceId(deviceId));
		});

		socket.on('settings', function () {
			socket.join('settings');
			socket.join('messaging');
			socket.emit('initialdata', source_types, source_types_datafields, source_types_busoptions, output_types, output_types_datafields, bus_options, sources, devices, device_sources, device_actions, device_states, tsl_clients, cloud_destinations, cloud_keys, cloud_clients);
			socket.emit('listener_clients', listener_clients);
			socket.emit('logs', Logs);
			socket.emit('PortsInUse', PortsInUse);
			socket.emit('tslclients_1secupdate', tsl_clients_1secupdate);
		});

		socket.on('producer', function () {
			socket.join('producer');
			socket.join('messaging');
			socket.emit('sources', sources);
			socket.emit('devices', devices);
			socket.emit('bus_options', bus_options);
			socket.emit('listener_clients', listener_clients);
		});

		socket.on('companion', function () {
			socket.join('companion');
			socket.emit('sources', sources);
			socket.emit('devices', devices);
			socket.emit('bus_options', bus_options);
			socket.emit('device_sources', device_sources);
			socket.emit('device_states', device_states);
			socket.emit('listener_clients', listener_clients);
			socket.emit('tsl_clients', tsl_clients);
			socket.emit('cloud_destinations', cloud_destinations);
		});

		socket.on('flash', function(clientId) {
			FlashListenerClient(clientId);
		});

		socket.on('messaging_client', function(clientId, type, socketid, message) {
			MessageListenerClient(clientId, type, socketid, message);
		});

		socket.on('reassign', function(clientId, oldDeviceId, deviceId) {
			ReassignListenerClient(clientId, oldDeviceId, deviceId);
		});

		socket.on('listener_reassign', function(oldDeviceId, deviceId) {
			socket.leave('device-' + oldDeviceId);
			socket.join('device-' + deviceId);

			for (let i = 0; i < listener_clients.length; i++) {
				if (listener_clients[i].socketId === socket.id) {
					listener_clients[i].deviceId = deviceId;
					listener_clients[i].inactive = false;
					break;
				}
			}

			let oldDeviceName = GetDeviceByDeviceId(oldDeviceId).name;
			let deviceName = GetDeviceByDeviceId(deviceId).name;

			logger(`Listener Client reassigned from ${oldDeviceName} to ${deviceName}`, 'info');
			UpdateSockets('listener_clients');
			UpdateCloud('listener_clients');
			socket.emit('device_states', GetDeviceStatesByDeviceId(deviceId));
		});

		socket.on('listener_reassign_relay', function(relayGroupId, oldDeviceId, deviceId) {
			let canRemove = true;
			for (let i = 0; i < listener_clients.length; i++) {
				if (listener_clients[i].socketId === socket.id) {
					if (listener_clients[i].deviceId === oldDeviceId) {
						if (listener_clients[i].relayGroupId !== relayGroupId) {
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

			for (let i = 0; i < listener_clients.length; i++) {
				if (listener_clients[i].relayGroupId === relayGroupId) {
					listener_clients[i].deviceId = deviceId;
				}
			}

			let oldDeviceName = GetDeviceByDeviceId(oldDeviceId).name;
			let deviceName = GetDeviceByDeviceId(deviceId).name;

			logger(`Listener Client reassigned from ${oldDeviceName} to ${deviceName}`, 'info');
			UpdateSockets('listener_clients');
			UpdateCloud('listener_clients');
		});

		socket.on('listener_reassign_gpo', function(gpoGroupId, oldDeviceId, deviceId) {
			let canRemove = true;
			for (let i = 0; i < listener_clients.length; i++) {
				if (listener_clients[i].socketId === socket.id) {
					if (listener_clients[i].deviceId === oldDeviceId) {
						if (listener_clients[i].gpoGroupId !== gpoGroupId) {
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

			for (let i = 0; i < listener_clients.length; i++) {
				if (listener_clients[i].gpoGroupId === gpoGroupId) {
					listener_clients[i].deviceId = deviceId;
				}
			}

			let oldDeviceName = GetDeviceByDeviceId(oldDeviceId).name;
			let deviceName = GetDeviceByDeviceId(deviceId).name;

			logger(`Listener Client reassigned from ${oldDeviceName} to ${deviceName}`, 'info');
			UpdateSockets('listener_clients');
			UpdateCloud('listener_clients');
		});

		socket.on('listener_reassign_object', function(reassignObj) {
			socket.leave('device-' + reassignObj.oldDeviceId);
			socket.join('device-' + reassignObj.newDeviceId);

			for (let i = 0; i < listener_clients.length; i++) {
				if (listener_clients[i].socketId === socket.id) {
					listener_clients[i].deviceId = reassignObj.newDeviceId;
					listener_clients[i].inactive = false;
					break;
				}
			}

			let oldDeviceName = GetDeviceByDeviceId(reassignObj.oldDeviceId).name;
			let deviceName = GetDeviceByDeviceId(reassignObj.newDeviceId).name;

			logger(`Listener Client reassigned from ${oldDeviceName} to ${deviceName}`, 'info');
			UpdateSockets('listener_clients');
			UpdateCloud('listener_clients');
			socket.emit('device_states', GetDeviceStatesByDeviceId(reassignObj.newDeviceId));
		});

		socket.on('listener_delete', function(clientId) { // emitted by the Settings page when an inactive client is being removed manually
			for (let i = listener_clients.length - 1; i >= 0; i--) {
				if (listener_clients[i].id === clientId) {
					logger(`Inactive Client removed: ${listener_clients[i].id}`, 'info');
					listener_clients.splice(i, 1);
					break;
				}
			}
			UpdateSockets('listener_clients');
			UpdateCloud('listener_clients');
		});

		socket.on('cloud_destination_reconnect', function(cloudDestinationId) {
			StartCloudDestination(cloudDestinationId);
		});

		socket.on('cloud_destination_disconnect', function(cloudDestinationId) {
			StopCloudDestination(cloudDestinationId);
		});

		socket.on('cloud_client', function(key) {
			let ipAddress = socket.request.connection.remoteAddress;

			if (cloud_keys.includes(key)) {
				let datetimeConnected = new Date().getTime();
				logger(`Cloud Client Connected: ${ipAddress}`, 'info');
				AddCloudClient(socket.id, key, ipAddress, datetimeConnected);
			}
			else {
				socket.emit('invalidkey');
				logger(`Cloud Client ${ipAddress} attempted connection with an invalid key: ${key}`, 'info');
				socket.disconnect();
			}
		});

		socket.on('cloud_sources', function(key, data) {
			let cloudClientId = GetCloudClientBySocketId(socket.id).id;

			//loop through the received array and if an item in the array isn't already in the sources array, add it, and attach the cloud ID as a property
			if (cloud_keys.includes(key)) {
				for (let i = 0; i < data.length; i++) {
					let found = false;

					for (j = 0; j < sources.length; j++) {
						if (data[i].id === sources[j].id) {
							found = true;
							sources[j].sourceTypeId = data[i].sourceTypeId;
							sources[j].name = data[i].name;
							sources[j].connected = data[i].connected;
							sources[j].cloudConnection = true;
							sources[j].cloudClientId = cloudClientId;
							break;
						}
					}

					if (!found) {
						data[i].cloudConnection = true;
						data[i].cloudClientId = cloudClientId;
						sources.push(data[i]);
					}
				}

				for (let i = 0; i < sources.length; i++) {
					let found = false;

					if (sources[i].cloudClientId === cloudClientId) {
						for (j = 0; j < data.length; j++) {
							if (sources[i].id === data[j].id) {
								found = true;
								break;
							}
						}

						if (!found) {
							//the client was deleted on the local source, so we should delete it here as well
							sources.splice(i, 1);
						}
					}
				}

				UpdateSockets('sources');
			}
			else {
				socket.emit('invalidkey');
				socket.disconnect();
			}
		});

		socket.on('cloud_devices', function(key, data) {
			let cloudClientId = GetCloudClientBySocketId(socket.id).id;

			//loop through the received array and if an item in the array isn't already in the devices array, add it, and attach the cloud ID as a property
			if (cloud_keys.includes(key)) {
				for (let i = 0; i < data.length; i++) {
					let found = false;

					for (j = 0; j < devices.length; j++) {
						if (data[i].id === devices[j].id) {
							found = true;
							devices[j].name = data[j].name;
							devices[j].description = data[j].description;
							devices[j].tslAddress = data[j].tslAddress;
							devices[j].enabled = data[j].enabled;
							devices[j].cloudConnection = true;
							devices[j].cloudClientId = cloudClientId;
							break;
						}
					}

					if (!found) {
						data[i].cloudConnection = true;
						data[i].cloudClientId = cloudClientId;
						devices.push(data[i]);

						let busId_preview = null;
						let busId_program = null;

						for (let i = 0; i < bus_options.length; i++) {
							switch(bus_options[i].type) {
								case 'preview':
									busId_preview = bus_options[i].id;
									break;
								case 'program':
									busId_program = bus_options[i].id;
									break;
								default:
									break;
							}
						}

						let deviceStateObj_preview = {};
						deviceStateObj_preview.deviceId = data[i].id;
						deviceStateObj_preview.busId = busId_preview;
						deviceStateObj_preview.sources = [];
						device_states.push(deviceStateObj_preview);

						let deviceStateObj_program = {};
						deviceStateObj_program.deviceId = data[i].id;
						deviceStateObj_program.busId = busId_program;
						deviceStateObj_program.sources = [];
						device_states.push(deviceStateObj_program);
					}
				}

				for (let i = 0; i < devices.length; i++) {
					let found = false;

					if (devices[i].cloudClientId === cloudClientId) {
						for (j = 0; j < data.length; j++) {
							if (devices[i].id === data[j].id) {
								found = true;
								break;
							}
						}

						if (!found) {
							//the client was deleted on the local source, so we should delete it here as well
							devices.splice(i, 1);
						}
					}
				}

				UpdateSockets('devices');
			}
			else {
				socket.emit('invalidkey');
				socket.disconnect();
			}
		});

		socket.on('cloud_device_sources', function(key, data) {
			let cloudClientId = GetCloudClientBySocketId(socket.id).id;

			//loop through the received array and if an item in the array isn't already in the device sources array, add it, and attach the cloud ID as a property
			if (cloud_keys.includes(key)) {
				for (let i = 0; i < data.length; i++) {
					let found = false;

					for (j = 0; j < device_sources.length; j++) {
						if (data[i].id === device_sources[j].id) {
							found = true;
							break;
						}
					}

					if (!found) {
						data[i].cloudConnection = true;
						data[i].cloudClientId = cloudClientId;
						device_sources.push(data[i]);
					}
				}

				for (let i = 0; i < device_sources.length; i++) {
					let found = false;

					if (device_sources[i].cloudClientId === cloudClientId) {
						for (j = 0; j < data.length; j++) {
							if (device_sources[i].id === data[j].id) {
								found = true;
								break;
							}
						}

						if (!found) {
							//the client was deleted on the local source, so we should delete it here as well
							device_sources.splice(i, 1);
						}
					}
				}
			}
			else {
				socket.emit('invalidkey');
				socket.disconnect();
			}
		});

		socket.on('cloud_listeners', function(key, data) {
			let cloudClientId = GetCloudClientBySocketId(socket.id).id;

			//loop through the received array and if an item in the array isn't already in the listener_clients array, add it, and attach the cloud ID as a property
			if (cloud_keys.includes(key)) {
				for (let i = 0; i < data.length; i++) {
					let found = false;

					for (j = 0; j < listener_clients.length; j++) {
						if (data[i].id === listener_clients[j].id) {
							found = true;
							listener_clients[j].socketId = data[i].socketId;
							listener_clients[j].deviceId = data[i].deviceId;
							listener_clients[j].listenerType = data[i].listenerType;
							listener_clients[j].ipAddress = data[i].ipAddress;
							listener_clients[j].datetimeConnected = data[i].datetimeConnected;
							listener_clients[j].inactive = data[i].inactive;
							listener_clients[j].cloudConnection = true;
							listener_clients[j].cloudClientId = cloudClientId;
							break;
						}
					}

					if (!found) {
						data[i].cloudConnection = true;
						data[i].cloudClientId = cloudClientId;
						listener_clients.push(data[i]);
					}
				}

				for (let i = 0; i < listener_clients.length; i++) {
					let found = false;

					if (listener_clients[i].cloudClientId === cloudClientId) {
						for (j = 0; j < data.length; j++) {
							if (listener_clients[i].id === data[j].id) {
								found = true;
								break;
							}
						}

						if (!found) {
							//the client was deleted on the local source, so we should delete it here as well
							listener_clients.splice(i, 1);
						}
					}
				}

				UpdateSockets('listener_clients');
			}
			else {
				socket.emit('invalidkey');
				socket.disconnect();
			}
		});

		socket.on('cloud_data', function(key, sourceId, tallyObj) {
			if (cloud_keys.includes(key)) {
				processTSLTally(sourceId, tallyObj);
			}
			else {
				socket.emit('invalidkey');
				socket.disconnect();
			}
		});

		socket.on('manage', function(arbiterObj) {
			response = TallyArbiter_Manage(arbiterObj);
			io.to('settings').emit('manage_response', response);
		});

		socket.on('reconnect_source', function(sourceId) {
			StartConnection(sourceId);
		});

		socket.on('device_sources_link', function(deviceId, bus, choice) {
			for (let i = 0; i < devices.length; i++) {
				if (devices[i].id === deviceId) {
					switch(bus) {
						case 'preview':
							devices[i].linkedPreview = choice;
							break;
						case 'program':
							devices[i].linkedProgram = choice;
							break;
					}
					SaveConfig();
					socket.emit('devices', devices);
					break;
				}
			}
		});

		socket.on('listener_clients', function() {
			socket.emit('listener_clients', listener_clients);
		});
		
		socket.on('tsl_clients', function() {
			socket.emit('tsl_clients', tsl_clients);
		});
		
		socket.on('cloud_destinations', function() {
			socket.emit('cloud_destinations', cloud_destinations);
		});

		socket.on('cloud_keys', function() {
			socket.emit('cloud_keys', cloud_keys);
		});

		socket.on('cloud_clients', function() {
			socket.emit('cloud_clients', cloud_clients);
		});

		socket.on('testmode', function(value) {
			EnableTestMode(value);
		});

		socket.on('tslclients_1secupdate', function(value) {
			tsl_clients_1secupdate = value;
			SaveConfig();
			TSLClients_1SecUpdate(value);
		})

		socket.on('messaging', function(type, message) {
			SendMessage(type, socket.id, message);
		});

		socket.on('disconnect', function() { // emitted when any socket.io client disconnects from the server
			DeactivateListenerClient(socket.id);
			CheckCloudClients(socket.id);
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

	logger('Starting VMix Emulation Service.', 'info-quiet');

	startVMixEmulator();

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
		logger(`Initiating ${cloud_destinations.length} Cloud Destination Connections.`, 'info');

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

function EnableTestMode(value) {
	TestMode = value;
	if (TestMode) {
		//first check that there's not already a "test mode" source
		let found = false;
		for (let i = 0; i < sources.length; i++) {
			if (sources[i].sourceTypeId === 'TESTMODE') {
				//already in test mode
				found = true;
				break;
			}
		}

		if (!found) {
			//turn on test mode
			let testSource = {};
			testSource.id = 'TEST';
			testSource.name = 'TEST MODE';
			testSource.sourceTypeId = 'TESTMODE';
			testSource.enabled = true;
			testSource.reconnect = false;
			testSource.connected = true;
			sources.push(testSource);
			UpdateSockets('sources');
			UpdateCloud('sources');
			TestTallies();
			SendMessage('server', null, 'Test Mode Enabled.');
		}
	}
	else {
		//turn off test mode
		ClearTallies();
		for (let i = 0; i < sources.length; i++) {
			if (sources[i].id === 'TEST') {
				sources.splice(i, 1);
				UpdateSockets('sources');
				UpdateCloud('sources');
				break;
			}
		}
		SendMessage('server', null, 'Test Mode Disabled.');
	}

	io.to('settings').emit('testmode', value);
}

function TestTallies() {
	InsertTestTally(0);
}

function InsertTestTally(i) {
	let sourceObj = {};
	sourceObj.sourceId = 'TEST';
	sourceObj.address = 'TEST';

	if (device_states[i]) { //make sure the index doesn't exceed the length of the device states array
		device_states[i].sources.push(sourceObj);
		UpdateDeviceState(device_states[i].deviceId); //Runs any outgoing actions for the device, if needed
		UpdateSockets('device_states');
		UpdateVMixClients();
		SendTSLClientData(device_states[i].deviceId);
		//SendCloudData(sourceId, tallyObj);
		setTimeout(ClearTestTally, 1000, i);
	}
}

function ClearTestTally(i) {
	for (let j = 0; j < device_states[i].sources.length; j++) {
		if (device_states[i].sources[j].sourceId === 'TEST' ) {
			device_states[i].sources.splice(j, 1);
			UpdateDeviceState(device_states[i].deviceId); //Runs any outgoing actions for the device, if needed
			UpdateSockets('device_states');
			UpdateVMixClients();
			SendTSLClientData(device_states[i].deviceId);
		}
	}

	if (TestMode) {
		if (i < (device_states.length -1)) {
			InsertTestTally(i+1);
		}
		else {
			InsertTestTally(0);
		}
	}
}

function ClearTallies() {
	for (let i = 0; i < device_states.length; i++) {
		for (let j = 0; j < device_states[i].sources.length; j++) {
			if (device_states[i].sources[j].sourceId === 'TEST') {
				device_states[i].sources.splice(j, 1);
				UpdateDeviceState(device_states[i].deviceId); //Runs any outgoing actions for the device, if needed
				UpdateSockets('device_states');
				UpdateVMixClients();
				SendTSLClientData(device_states[i].deviceId);
			}
		}
	}
}

function startVMixEmulator() {
	vmix_emulator = net.createServer();

	vmix_emulator.on('connection', handleConnection);

	vmix_emulator.listen(8099, function() {
		logger(`Finished VMix Emulation Setup. Listening for VMix Tally Connections on TCP Port 8099.`, 'info-quiet');
	});

	function handleConnection(conn) {
		let host = conn.remoteAddress + ':' + conn.remotePort;
		logger(`New VMix Emulator Connection from ${host}`, 'info');
		conn.on('data', onConnData);
		conn.once('close', onConnClose);
		conn.on('error', onConnError);

		function onConnData(d) {
			d = d.toString().split(/\r?\n/);

			if (d[0] === 'SUBSCRIBE TALLY') {
				addVmixListener(conn, host);
				conn.write('SUBSCRIBE OK TALLY\r\n');
			}
			else if (d[0] === 'UNSUBSCRIBE TALLY') {
				conn.write('UNSUBSCRIBE OK TALLY\r\n');
				removeVmixListener(host);
			}
			else if (d[0] === 'QUIT') {
				conn.destroy();
			}
		}
		function onConnClose() {
			removeVmixListener(host);
			logger(`VMix Emulator Connection from ${host} closed`, 'info');
		}
		function onConnError(err) {
			logger(`VMix Emulator Connection ${host} error: ${err.message}`, 'error');
		}
	}
}

function addVmixListener(conn, host) {
	let socketId = 'vmix-' + uuidv4();
	let listenerClientId = AddListenerClient(socketId, null, 'vmix', host, new Date().getTime(), false, false);
	conn.listenerClientId = listenerClientId;
	conn.host = host;
	conn.socketId = socketId;
	vmix_clients.push(conn);
	logger(`VMix Emulator Connection ${host} subscribed to tally`, 'info');
}

function removeVmixListener(host) {
	let socketId = null;

	for (let i = 0; i < vmix_clients.length; i++) {
		if (vmix_clients[i].host === host) {
			socketId = vmix_clients[i].socketId;
			vmix_clients.splice(i, 1);
		}
	}

	if (socketId !== null) {
		DeactivateListenerClient(socketId);
	}

	logger(`VMix Emulator Connection ${host} unsubscribed to tally`, 'info');
}

function logger(log, type) { //logs the item to the console, to the log array, and sends the log item to the settings page

	let dtNow = new Date();

	if (type === undefined) {
		type = 'info-quiet';
	}

	switch(type) {
		case 'info':
		case 'info-quiet':
			console.log(`[${dtNow}]     ${log}`);
			break;
		case 'error':
			console.log(`[${dtNow}]     ${clc.red.bold(log)}`);
			break;
		case 'console_action':
			console.log(`[${dtNow}]     ${clc.green.bold(log)}`);
			break;
		default:
			console.log(`[${dtNow}]     ${util.inspect(log, {depth: null})}`);
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

		if (configJson.security) {
			if (configJson.security.username_settings) {
				username_settings = configJson.security.username_settings;
			}
			if (configJson.security.password_settings) {
				password_settings = configJson.security.password_settings;
			}
			if (configJson.security.username_producer) {
				username_producer = configJson.security.username_producer;
			}
			if (configJson.security.password_producer) {
				password_producer = configJson.security.password_producer;
			}
		}

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

		if (configJson.tsl_clients_1secupdate) {
			tsl_clients_1secupdate = true;
			TSLClients_1SecUpdate(true);
		}
		else {
			tsl_clients_1secupdate = false;
			TSLClients_1SecUpdate(false);
		}

		if (configJson.cloud_destinations) {
			cloud_destinations = configJson.cloud_destinations;
			logger('Tally Arbiter Cloud Destinations loaded.', 'info');
		}
		else {
			cloud_destinations = [];
			logger('Tally Arbiter Cloud Destinations could not be loaded.', 'error');
		}

		if (configJson.cloud_keys) {
			cloud_keys = configJson.cloud_keys;
			logger('Tally Arbiter Cloud Keys loaded.', 'info');
		}
		else {
			cloud_keys = [];
			logger('Tally Arbiter Cloud Keys could not be loaded.', 'error');
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
		if ((sources[i].enabled) && (!sources[i].cloudConnection)) {
			let sourceType = source_types.find( ({ id }) => id === sources[i].sourceTypeId);

			logger(`Initiating Setup for Source: ${sources[i].name}. Type: ${sourceType.label}`, 'info-quiet');

			switch(sourceType.type) {
				case 'tsl_31_udp':
					SetUpTSLServer_UDP(sources[i].id);
					break;
				case 'tsl_31_tcp':
					SetUpTSLServer_TCP(sources[i].id);
					break;
				case 'tsl_5_udp':
					SetUpTSL5Server_UDP(sources[i].id);
					break;
				case 'tsl_5_tcp':
					SetUpTSL5Server_TCP(sources[i].id);
					break;
				case 'atem':
					SetUpATEMServer(sources[i].id);
					break;
				case 'videohub':
					SetUpVideoHubServer(sources[i].id);
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
				case 'roland-vr':
					SetUpRolandVR(sources[i].id);
					break;
				case 'ross_carbonite':
					SetUpRossCarbonite(sources[i].id);
					break;
				case 'osc':
					SetUpOSCServer(sources[i].id);
					break;
				case 'tc':
					SetUpTricasterServer(sources[i].id);
					break;
				case 'awlivecore':
					SetUpAWLivecoreServer(sources[i].id);
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

function SaveConfig() {
	try {
		let securityObj = {};
		securityObj.username_settings = username_settings;
		securityObj.password_settings = password_settings;
		securityObj.username_producer = username_producer;
		securityObj.password_producer = password_producer;

		let tsl_clients_clean = [];

		for (let i = 0; i < tsl_clients.length; i++) {
			let tslClientObj = {};
			tslClientObj.id = tsl_clients[i].id;
			tslClientObj.ip = tsl_clients[i].ip;
			tslClientObj.port = tsl_clients[i].port;
			tslClientObj.transport = tsl_clients[i].transport;
			tsl_clients_clean.push(tslClientObj);
		}

		let configJson = {
			security: securityObj,
			sources: sources,
			devices: devices,
			device_sources: device_sources,
			device_actions: device_actions,
			tsl_clients: tsl_clients_clean,
			tsl_clients_1secupdate: tsl_clients_1secupdate,
			cloud_destinations: cloud_destinations,
			cloud_keys: cloud_keys,
		};

		fs.writeFileSync(config_file, JSON.stringify(configJson, null, 1), 'utf8', function(error) {
			if (error)
			{ 
				logger(`Error saving configuration to file: ${error}`, 'error');
			}
		});

		logger('Config file saved to disk.', 'info-quiet');
	}
	catch (error) {
		logger(`Error saving configuration to file: ${error}`, 'error');
	}
}

function initializeDeviceStates() { // initializes each device state in the array upon server startup
	logger('Initializing Device States.', 'info-quiet');

	let busId_preview = null;
	let busId_program = null;

	for (let i = 0; i < bus_options.length; i++) {
		switch(bus_options[i].type) {
			case 'preview':
				busId_preview = bus_options[i].id;
				break;
			case 'program':
				busId_program = bus_options[i].id;
				break;
			default:
				break;
		}
	}

	for (let i = 0; i < devices.length; i++) {
		let deviceStateObj_preview = {};
		deviceStateObj_preview.deviceId = devices[i].id;
		deviceStateObj_preview.busId = busId_preview;
		deviceStateObj_preview.sources = [];
		deviceStateObj_preview.linkedSources = [];
		device_states.push(deviceStateObj_preview);

		let deviceStateObj_program = {};
		deviceStateObj_program.deviceId = devices[i].id;
		deviceStateObj_program.busId = busId_program;
		deviceStateObj_program.sources = [];
		deviceStateObj_program.linkedSources = [];
		device_states.push(deviceStateObj_program);
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
				logger(`Source: ${source.name}  Creating TSL 3.1 UDP Connection.`, 'info-quiet');
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
				UpdateSockets('sources');
				UpdateCloud('sources');
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
				logger(`Source: ${source.name}  Closing TSL 3.1 UDP Connection.`, 'info-quiet');
				source_connections[i].server.server.close();
				DeletePort(source.data.port);
				logger(`Source: ${source.name}  TSL 3.1 UDP Server Stopped. Connection Closed.`, 'info');
				for (let j = 0; j < sources.length; j++) {
					if (sources[j].id === sourceId) {
						sources[j].connected = false;
						break;
					}
				}

				UpdateSockets('sources');
				UpdateCloud('sources');
				break;
			}
		}
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
				logger(`Source: ${source.name}  Creating TSL 3.1 TCP Connection.`, 'info-quiet');
				source_connections[i].server = net.createServer(function (socket) {
					socket.on('data', function (data) {
						parser.extract('tsl', function (result) {
							result.label = new Buffer(result.label).toString();
							processTSLTally(sourceId, result);
						});
						parser.parse(data);
					});

					socket.on('close', function () {
						logger(`Source: ${source.name}  TSL 3.1 Server connection closed.`, 'info');
						StopTSLServer_TCP(sourceId);
					});
				}).listen(port, function() {
					logger(`Source: ${source.name}  TSL 3.1 Server started. Listening for data on TCP Port: ${port}`, 'info');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = true;
							UnregisterReconnect(sources[j].id);
							break;
						}
					}
					UpdateSockets('sources');
					UpdateCloud('sources');

				});
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

	RegisterDisconnect(sourceId);

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

				UpdateSockets('sources');
				UpdateCloud('sources');
				break;
			}
		}
	}
	catch (error) {
		logger(`Source: ${source.name}  TSL 3.1 TCP Server Error occurred: ${error}`, 'error');
	}
}

function SetUpTSL5Server_UDP(sourceId)
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
				logger(`Source: ${source.name}  Creating TSL 5.0 UDP Connection.`, 'info-quiet');
				source_connections[i].server = dgram.createSocket('udp4');
				source_connections[i].server.bind(port);

				source_connections[i].server.on('message', function (message) {
					processTSL5Tally(sourceId, message);
				});

				logger(`Source: ${source.name}  TSL 5.0 Server started. Listening for data on UDP Port: ${port}`, 'info');
				for (let j = 0; j < sources.length; j++) {
					if (sources[j].id === sourceId) {
						sources[j].connected = true;
						break;
					}
				}
				UpdateSockets('sources');
				UpdateCloud('sources');
				break;
			}
		}
	} catch (error)
	{
		logger(`Source: ${source.name}  TSL 5.0 UDP Server Error occurred: ${error}`, 'error');
	}
}

function StopTSL5Server_UDP(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);

	try
	{
		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				logger(`Source: ${source.name}  Closing TSL 5.0 UDP Connection.`, 'info-quiet');
				source_connections[i].server.close();
				DeletePort(source.data.port);
				logger(`Source: ${source.name}  TSL 5.0 UDP Server Stopped. Connection Closed.`, 'info');
				for (let j = 0; j < sources.length; j++) {
					if (sources[j].id === sourceId) {
						sources[j].connected = false;
						break;
					}
				}

				UpdateSockets('sources');
				UpdateCloud('sources');
				break;
			}
		}
	}
	catch (error) {
		logger(`Source: ${source.name}  TSL 5.0 UDP Server Error occurred: ${error}`, 'error');
	}
}

function SetUpTSL5Server_TCP(sourceId)
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
				logger(`Source: ${source.name}  Creating TSL 5.0 TCP Connection.`, 'info-quiet');
				source_connections[i].server = net.createServer(function (socket) {
					socket.on('data', function (data) {
						processTSL5Tally(sourceId, data);
					});

					socket.on('close', function () {
						logger(`Source: ${source.name}  TSL 5.0 Server connection closed.`, 'info');
						StopTSLServer_TCP(sourceId);
						CheckReconnect(sourceId);
					});
				}).listen(port, function() {
					logger(`Source: ${source.name}  TSL 5.0 Server started. Listening for data on TCP Port: ${port}`, 'info');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = true;
							UnregisterReconnect(sources[j].id);
							break;
						}
					}
					UpdateSockets('sources');
					UpdateCloud('sources');
				});
				break;
			}
		}
	}
	catch (error) {
		logger(`Source: ${source.name}  TSL 5.0 TCP Server Error occurred: ${error}`, 'error');
	}
}

function StopTSL5Server_TCP(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);

	RegisterDisconnect(sourceId);

	try
	{
		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				source_connections[i].server.close(function() {});
				DeletePort(source.data.port);
				logger(`Source: ${source.name}  TSL 5.0 TCP Server Stopped.`, 'info');
				for (let j = 0; j < sources.length; j++) {
					if (sources[j].id === sourceId) {
						sources[j].connected = false;
						break;
					}
				}

				UpdateSockets('sources');
				UpdateCloud('sources');
				break;
			}
		}
	}
	catch (error) {
		logger(`Source: ${source.name}  TSL 5.0 TCP Server Error occurred: ${error}`, 'error');
	}
}

function processTSL5Tally(sourceId, data) {
	if (data.length > 12) {

		tallyobj = {};

		var cursor = 0;

		//Message Format
		const _PBC = 2 //bytes
		const _VAR = 1
		const _FLAGS = 1
		const _SCREEN = 2
		const _INDEX = 2
		const _CONTROL = 2

		//Display Data
		const _LENGTH = 2

		tallyobj.PBC = jspack.Unpack( "<H", data, cursor);
		cursor += _PBC;

		tallyobj.VAR = jspack.Unpack( "<B", data, cursor);
		cursor += _VAR;

		tallyobj.FLAGS = jspack.Unpack( "<B", data, cursor);
		cursor += _FLAGS;

		tallyobj.SCREEN = jspack.Unpack( "<H", data, cursor);
		cursor += _SCREEN;

		tallyobj.INDEX = jspack.Unpack( "<H", data, cursor);
		cursor += _INDEX;

		tallyobj.CONTROL = jspack.Unpack( "<H", data, cursor);
		cursor += _CONTROL;

		tallyobj.control = {};
		tallyobj.control.rh_tally = (tallyobj.CONTROL >> 0 & 0b11);
		tallyobj.control.text_tally = (tallyobj.CONTROL >> 2 & 0b11);
		tallyobj.control.lh_tally = (tallyobj.CONTROL >> 4 & 0b11);
		tallyobj.control.brightness = (tallyobj.CONTROL >> 6 & 0b11);
		tallyobj.control.reserved = (tallyobj.CONTROL >> 8 & 0b1111111);
		tallyobj.control.control_data = (tallyobj.CONTROL >> 15 & 0b1);

		var LENGTH = jspack.Unpack( "<H", data, cursor)
		cursor += _LENGTH;

		tallyobj.TEXT = jspack.Unpack( "s".repeat(LENGTH), data, cursor)

		//tally1 === lh tally
		//tally2 === rh tally

		let inPreview = 0;
		let inProgram = 0;

		if ((tallyobj.control.lh_tally === 2) && (tallyobj.control.rh_tally === 2)) { //device is in Preview only
			inPreview = 1;
			inProgram = 0;
		}
		else if ((tallyobj.control.lh_tally === 1) && (tallyobj.control.rh_tally === 1)) { //device is in Program only
			inPreview = 0;
			inProgram = 1;
		}
		else if ((tallyobj.control.lh_tally === 1) && (tallyobj.control.rh_tally === 2)) { //device is in PVW+PGM
			inPreview = 1;
			inProgram = 1;
		}

		let newTallyObj = {};
		newTallyObj.tally1 = inPreview;
		newTallyObj.tally2 = inProgram;
		newTallyObj.address = tallyobj.INDEX[0];
		newTallyObj.label = tallyobj.TEXT.join('').trim();

		processTSLTally(sourceId, newTallyObj);
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
					source_connections[i].server = new Atem();

					source_connections[i].server.on('connected', () => {
						for (let j = 0; j < sources.length; j++) {
							if (sources[j].id === sourceId) {
								sources[j].connected = true;
								break;
							}
						}
						logger(`Source: ${source.name} ATEM connection opened.`, 'info');
						UnregisterReconnect(source.id);
						UpdateSockets('sources');
						UpdateCloud('sources');
					});

					source_connections[i].server.on('disconnected', () => {
						for (let j = 0; j < sources.length; j++) {
							if (sources[j].id === sourceId) {
								sources[j].connected = false;
								CheckReconnect(sources[j].id);
								break;
							}
						}
						logger(`Source: ${source.name} ATEM connection closed.`, 'info');
						UpdateSockets('sources');
						UpdateCloud('sources');
					});
					
					source_connections[i].server.on('stateChanged', (state, path) => {
						for (let h = 0; h < path.length; h++) {
							if (path[h] === 'info.capabilities') {
								//console.log(state.info.capabilities);
							}
							else if (path[h].indexOf('video.mixEffects') > -1) {
								for (let i = 0; i < state.video.mixEffects.length; i++) {
									processATEMTally(sourceId, state.video.mixEffects[i].index+1, state.video.mixEffects[i].programInput, state.video.mixEffects[i].previewInput);
								}
							}
						}
					});

					source_connections[i].server.on('info', console.log);
					source_connections[i].server.on('error', console.error);

					source_connections[i].server.connect(atemIP);
				}
				catch(error) {
					logger(`ATEM Error: ${error}`, 'error');
				}

				break;
			}
		}
	}
	catch (error) {
		logger(`ATEM Error: ${error}`, 'error');
	}
}

function processATEMTally(sourceId, me, programInput, previewInput) {
	let source = GetSourceBySourceId(sourceId);

	let atemSourceFound = false;

	//first loop through the ATEM tally data array, by SourceId and ME; if it's present, update the current program/preview inputs
	for (let i = 0; i < tallydata_ATEM.length; i++) {
		if (tallydata_ATEM[i].sourceId === sourceId) {
			if (tallydata_ATEM[i].me === me.toString()) {
				atemSourceFound = true;
				tallydata_ATEM[i].programInput = programInput.toString();
				tallydata_ATEM[i].previewInput = previewInput.toString();
			}
		}
	}

	//if it was not in the tally array for this SourceId and ME, add it
	if (!atemSourceFound) {
		let atemTallyObj = {};
		atemTallyObj.sourceId = sourceId;
		atemTallyObj.me = me.toString();
		atemTallyObj.programInput = programInput.toString();
		atemTallyObj.previewInput = previewInput.toString();
		tallydata_ATEM.push(atemTallyObj);
	}

	//now loop through the updated array, and if an ME is one chosen to monitor for this SourceId,
	//grab the program input and put it into a temp array of program inputs
	//grab the preview input and put it into a temp array of preview inputs

	let allPrograms = [];
	let allPreviews = [];

	for (let i = 0; i < tallydata_ATEM.length; i++) {
		if (tallydata_ATEM[i].sourceId === sourceId) {
			if (source.data.me_onair.includes(tallydata_ATEM[i].me)) {
				allPrograms.push(tallydata_ATEM[i].programInput.toString());
				allPreviews.push(tallydata_ATEM[i].previewInput.toString());
			}
		}
	}

	//loop through the temp array of program inputs;
	//if that program input is also in the preview array, build a TSL-type object that has it in pvw+pgm
	//if only pgm, build an object of only pgm

	for (let i = 0; i < allPrograms.length; i++) {
		let includePreview = false;
		if (allPreviews.includes(allPrograms[i])) {
			includePreview = true;
		}

		let tallyObj = {};
		tallyObj.address = allPrograms[i];
		tallyObj.brightness = 1;
		tallyObj.tally1 = (includePreview ? 1 : 0);
		tallyObj.tally2 = 1;
		tallyObj.tally3 = 0;
		tallyObj.tally4 = 0;
		tallyObj.label = `Source ${allPrograms[i]}`;
		processTSLTally(sourceId, tallyObj);
	}

	//now loop through the temp array of pvw inputs
	//if that input is not in the program array, build a TSL object of only pvw

	for (let i = 0; i < allPreviews.length; i++) {
		let onlyPreview = true;

		if (allPrograms.includes(allPreviews[i])) {
			onlyPreview = false;
		}

		if (onlyPreview) {
			let tallyObj = {};
			tallyObj.address = allPreviews[i];
			tallyObj.brightness = 1;
			tallyObj.tally1 = 1;
			tallyObj.tally2 = 0;
			tallyObj.tally3 = 0;
			tallyObj.tally4 = 0;
			tallyObj.label = `Source ${allPreviews[i]}`;
			processTSLTally(sourceId, tallyObj);
		}
	}

	//finally clear out any device state that is no longer in preview or program
	let device_sources_atem = GetDeviceSourcesBySourceId(sourceId);
	for (let i = 0; i < device_sources_atem.length; i++) {
		let inProgram = false;
		let inPreview = false;

		if (allPrograms.includes(device_sources_atem[i].address)) {
			//the device is still in program, somewhere
			inProgram = true;
		}
		if (allPreviews.includes(device_sources_atem[i].address)) {
			//the device is still in preview, somewhere
			inPreview = true;
		}

		if ((!inProgram) && (!inPreview)) {
			//the device is no longer in preview or program anywhere, so remove it
			let tallyObj = {};
			tallyObj.address = device_sources_atem[i].address;
			tallyObj.brightness = 1;
			tallyObj.tally1 = 0;
			tallyObj.tally2 = 0;
			tallyObj.tally3 = 0;
			tallyObj.tally4 = 0;
			tallyObj.label = `Source ${device_sources_atem[i].address}`;
			processTSLTally(sourceId, tallyObj);
		}
	}
}

function StopATEMServer(sourceId) {
	let source = GetSourceBySourceId(sourceId);

	RegisterDisconnect(sourceId);

	for (let i = 0; i < source_connections.length; i++) {
		if (source_connections[i].sourceId === sourceId) {
			source_connections[i].server.disconnect(null);
			logger(`Source: ${source.name}  ATEM connection closed.`, 'info');
			break;
		}
	}
}

function SetUpVideoHubServer(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);

	try {
		let ip = source.data.ip;
		let port = 9990;

		let sourceConnectionObj = {};
		sourceConnectionObj.sourceId = sourceId;
		sourceConnectionObj.server = null;
		source_connections.push(sourceConnectionObj);

		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				try {
					logger(`Source: ${source.name}  Creating VideoHub connection.`, 'info-quiet');

					source_connections[i].server = new net.Socket();

					source_connections[i].receiveBuffer = '';
					source_connections[i].command = null;
					source_connections[i].stash = [];

					source_connections[i].server.on('error', function(error) {
						logger(`VideoHub Error: ${error}`, 'error');
					});

					source_connections[i].server.on('connect', function() {
						logger(`Source: ${source.name}  VideoHub connected.`, 'info-quiet');
						for (let j = 0; j < sources.length; j++) {
							if (sources[j].id === sourceId) {
								sources[j].connected = true;
								UnregisterReconnect(sources[j].id);
								break;
							}
						}
						UpdateSockets('sources');
						UpdateCloud('sources');
					});

					source_connections[i].server.on('data', function(chunk) {
						let j = 0, line = '', offset = 0;
						source_connections[i].receiveBuffer += chunk;
		
						while ( (j = source_connections[i].receiveBuffer.indexOf('\n', offset)) !== -1) {
							line = source_connections[i].receiveBuffer.substr(offset, j - offset);
							offset = j + 1;
							source_connections[i].server.emit('receiveline', line.toString());
						}
		
						source_connections[i].receiveBuffer = source_connections[i].receiveBuffer.substr(offset);
					});

					source_connections[i].server.on('receiveline', function(line) {
						if (source_connections[i].command === null && line.match(/:/) ) {
							source_connections[i].command = line;
						}
						else if (source_connections[i].command !== null && line.length > 0) {
							source_connections[i].stash.push(line.trim());
						}
						else if (line.length === 0 && source_connections[i].command !== null) {
							let cmd = source_connections[i].command.trim().split(/:/)[0];
		
							processVideohubInformation(sourceId, cmd, source_connections[i].stash);
		
							source_connections[i].stash = [];
							source_connections[i].command = null;
						}
					});

					source_connections[i].server.on('close', function() {
						logger(`Source: ${source.name}  VideoHub Connection closed.`, 'info');
						for (let j = 0; j < sources.length; j++) {
							if (sources[j].id === sourceId) {
								sources[j].connected = false;
								CheckReconnect(sources[j].id);
								break;
							}
						}
						UpdateSockets('sources');
						UpdateCloud('sources');
					});

					source_connections[i].server.connect(port, ip);
				}
				catch(error) {
					logger(`Source: ${source.name}  VideoHub Error: ${error}`, 'error');
				}
			}
		}

	}
	catch(error) {
		logger(`Source: ${source.name}  VideoHub Error: ${error}`, 'error');
	}
}

function processVideohubInformation(sourceId, cmd, stash) {
	if (cmd.match(/VIDEO OUTPUT ROUTING/)) {
		for (let i = 0; i < stash.length; i++) {
			let destination = parseInt(stash[i].substr(0, stash[i].indexOf(' ')));
			let source = parseInt(stash[i].substr(stash[i].indexOf(' ')));
			destination++; //zero-based so we increment it
			source++;//zero-based so we increment it

			processVideoHubTally(sourceId, destination, source);
		}
	}
	else if (cmd.match(/INPUT LABELS/)) {
		for (let i = 0; i < stash.length; i++) {
			let source = parseInt(stash[i].substr(0, stash[i].indexOf(' ')));
			source++; //zero-based so we increment it
			let name = stash[i].substr(stash[i].indexOf(' '));
			addVideoHubInformation(sourceId, source, name);
		}
	}
}

function addVideoHubInformation(sourceId, source, name) {
	let found = false;
	for (let i = 0; i < labels_VideoHub.length; i++) {
		if (labels_VideoHub[i].sourceId === sourceId) {
			if (labels_VideoHub[i].source === source) {
				found = true;
				labels_VideoHub[i].name = name;
				break;
			}
		}
	}

	if (!found) {
		let labelObj = {};
		labelObj.sourceId = sourceId;
		labelObj.source = source;
		labelObj.name = name;
		labels_VideoHub.push(labelObj);
	}
}

function processVideoHubTally(sourceId, destination, src) {
	//this builds the tallydata_Videohub array and makes sure it has an initial state
	let tallyFound = false;

	for (let i = 0; i < tallydata_VideoHub.length; i++) {
		if (tallydata_VideoHub[i].sourceId === sourceId) {
			if (tallydata_VideoHub[i].address === src) {
				tallyFound = true;
				break;
			}
		}
	}

	if (!tallyFound) {
		let tallyObj = {};
		tallyObj.sourceId = sourceId;
		tallyObj.address = src;
		tallyObj.label = getVideoHubSourceName(sourceId, src);
		tallydata_VideoHub.push(tallyObj);
	}

	updateVideoHubDestination(sourceId, destination, src);
}

function updateVideoHubDestination(sourceId, destination, src) {
	//maintains an array of videohub destinations and their active sources

	let source = GetSourceBySourceId(sourceId);

	let found = false;

	let recheck_sources = [];

	//loop through and update the destinations array with the new source
	//if the source has changed, add the previous source to a new array to recheck the state of that source
	for (let i = 0; i < destinations_VideoHub.length; i++) {
		if (destinations_VideoHub[i].sourceId === sourceId) {
			if (destinations_VideoHub[i].destination === destination) {
				if (destinations_VideoHub[i].source !== src) {
					//the source has changed, so we will need to recheck that old source to make sure it is not in pvw/pgm anywhere else
					recheck_sources.push(destinations_VideoHub[i].source);
				}
				destinations_VideoHub[i].source = src;
				found = true;
				break;
			}
		}
	}

	if (!found) {
		let destinationObj = {};
		destinationObj.sourceId = sourceId;
		destinationObj.destination = destination;
		destinationObj.source = src;
		destinations_VideoHub.push(destinationObj);
	}

	//check to see if any of the destinations currently have this source and if that destination is configured as a preview or program bus
	let inPreview = false;
	let inProgram = false;

	for (let i = 0; i < destinations_VideoHub.length; i++) {
		if (destinations_VideoHub[i].source === src) {
			if (source.data.destinations_pvw.includes(destinations_VideoHub[i].destination)) {
				inPreview = true;
			}
			if (source.data.destinations_pgm.includes(destinations_VideoHub[i].destination)) {
				inProgram = true;
			}
		}
	}

	for (let i = 0; i < tallydata_VideoHub.length; i++) {
		if (tallydata_VideoHub[i].sourceId === sourceId) {
			if (tallydata_VideoHub[i].address === src) {
				tallydata_VideoHub[i].tally1 = (inPreview ? 1 : 0);
				tallydata_VideoHub[i].tally2 = (inProgram ? 1 : 0);	
				processTSLTally(sourceId, tallydata_VideoHub[i]);
			}
		}
	}

	//now recheck any source that used to be in this destination and make sure they are not in pvw/pgm elsewhere
	for (let i = 0; i < recheck_sources.length; i++) {
		let inPreview = false;
		let inProgram = false;
		for (let j = 0; j < destinations_VideoHub.length; j++) {
			if (destinations_VideoHub[j].source === recheck_sources[i]) {
				//check and see if this destination is a pvw or pgm type
				if (source.data.destinations_pvw.includes(destinations_VideoHub[j].destination)) {
					inPreview = true;
				}
				if (source.data.destinations_pgm.includes(destinations_VideoHub[j].destination)) {
					inProgram = true;
				}
			}
		}

		for (let j = 0; j < tallydata_VideoHub.length; j++) {
			if (tallydata_VideoHub[j].sourceId === sourceId) {
				if (tallydata_VideoHub[j].address === recheck_sources[i]) {
					tallydata_VideoHub[j].tally1 = (inPreview ? 1 : 0);
					tallydata_VideoHub[j].tally2 = (inProgram ? 1 : 0);	
					processTSLTally(sourceId, tallydata_VideoHub[j]);
				}
			}
		}
	}
}

function getVideoHubSourceName(sourceId, source) {
	let returnVal = null;

	for (let i = 0; i < labels_VideoHub.length; i++) {
		if (labels_VideoHub[i].sourceId === sourceId) {
			if (labels_VideoHub[i].source === source) {
				returnVal = labels_VideoHub[i].name;
				break;
			}
		}
	}

	return returnVal;
}

function StopVideoHubServer(sourceId) {
	let source = GetSourceBySourceId(sourceId);

	RegisterDisconnect(sourceId);

	for (let i = 0; i < source_connections.length; i++) {
		if (source_connections[i].sourceId === sourceId) {
			source_connections[i].server.end();
			logger(`Source: ${source.name}  VideoHub connection closed.`, 'info');
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
						addOBSSource(sourceId,'{{STREAMING}}');
						addOBSSource(sourceId,'{{RECORDING}}');
                        //Retrieve all the current sources and add them
                        source_connections[i].server.sendCallback('GetSourcesList', function(err,data){
                            if(err || data.sources == undefined) return;
                            data.sources.forEach(source => {
                                addOBSSource(sourceId,source.name);
                            });
                        });
                        var sourceIndex = sources.findIndex(src => src.id == sourceId);
                        if(sourceIndex !== undefined){
                            console.log('found index',sourceIndex);
                            sources[sourceIndex].connected = true; //todo fix
                            UnregisterReconnect(sources[sourceIndex].id);
                        }
						UpdateSockets('sources');
						UpdateCloud('sources');
					});

					source_connections[i].server.on('ConnectionClosed', function (data) {
						logger(`Source: ${source.name} OBS Connection closed.`, 'info');
						for (let j = 0; j < sources.length; j++) {
							if (sources[j].id === sourceId) {
								sources[j].connected = false;
								CheckReconnect(sources[j].id);
								break;
							}
						}
						UpdateSockets('sources');
						UpdateCloud('sources');
					});

					source_connections[i].server.on('AuthenticationSuccess', function (data) {
						logger(`Source: ${source.name}  OBS Authenticated.`, 'info-quiet');
					});

					source_connections[i].server.on('AuthenticationFailure', function (data) {
						logger(`Source: ${source.name}  Invalid OBS Password.`, 'info');
					});

					source_connections[i].server.on('PreviewSceneChanged', function (data) {
						logger(`Source: ${source.name}  Preview Scene Changed.`, 'info-quiet');
						if (data) {
							if (data.sources)
							{
								processOBSTally(sourceId, data.sources, 'preview');
							}
						}
					});

					source_connections[i].server.on('SwitchScenes', function (data) {
						logger(`Source: ${source.name}  Program Scene Changed.`, 'info-quiet');
						if (data) {
							if (data.sources)
							{
								processOBSTally(sourceId, data.sources, 'program');
							}
						}
					});
                    
                    source_connections[i].server.on('SourceCreated', function (data) {
						logger(`Source: ${source.name}  New source created`, 'info-quiet');
                        addOBSSource(sourceId,data.sourceName);
					});
                    
                    source_connections[i].server.on('SourceDestroyed', function (data) {
                        deleteOBSSource(sourceId,data.sourceName);
					});
                    
                    source_connections[i].server.on('SourceRenamed', function (data) {
						logger(`Source: ${source.name}  Source renamed`, 'info-quiet');
                        renameOBSSource(sourceId,data.previousName,data.newName);                        
					});

					source_connections[i].server.on('StreamStarted', function(data) {
						let obsTally = [
							{
								name: '{{STREAMING}}',
								render: true
							}
						];
						processOBSTally(sourceId, obsTally, 'program');
					});
			
					source_connections[i].server.on('StreamStopped', function() {
						let obsTally = [
							{
								name: '{{STREAMING}}',
								render: false
							}
						];
						processOBSTally(sourceId, obsTally, 'program');
					});

					source_connections[i].server.on('RecordingStarted', function() {
						let obsTally = [
							{
								name: '{{RECORDING}}',
								render: true
							}
						];
						processOBSTally(sourceId, obsTally, 'program');
					});
			
					source_connections[i].server.on('RecordingStopped', function() {
						let obsTally = [
							{
								name: '{{RECORDING}}',
								render: false
							}
						];
						processOBSTally(sourceId, obsTally, 'program');
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

function addOBSSource(sourceId, name) {
    //Double check its not there already, this also allows methods like processOBSTally to call this without caring whether it already exists or not
    var exists = tallydata_OBS.find(function(src){
        return (src.sourceId == sourceId && src.address == name);
    });
    if(exists !== undefined) return;
    //Doesn't exist, add it
    tallydata_OBS.push({
        sourceId: sourceId,
        label: name,
        address: name,
        tally1: 0,
        tally2: 0,
        tally3: 0,
        tally4: 0
    });
    logger(`OBS Tally Source: ${sourceId} Added new source: ${name}`, 'info-quiet');
}

function renameOBSSource(sourceId, oldname, newname) {
    let sourceIndex = tallydata_OBS.findIndex(src => src.sourceId === sourceId && src.address === oldname);
    if(sourceIndex === undefined) return;
    tallydata_OBS[sourceIndex].label = newname;
    tallydata_OBS[sourceIndex].address = newname;
    logger(`OBS Tally Source: ${sourceId} Renamed source: ${oldname} to ${newname}`, 'info-quiet');
    let deviceSourceIndex = device_sources.findIndex(src => src.sourceId === sourceId && src.address === oldname);
    if(deviceSourceIndex > -1){
        device_sources[deviceSourceIndex].address = newname;
        UpdateCloud('device_sources');
        logger(`Device Source Edited: ${deviceName} - ${sourceName}`, 'info');
    }    
}

function deleteOBSSource(sourceId, name) {
    let sourceIndex = tallydata_OBS.findIndex(src => src.sourceId === sourceId && src.address === name);
    if(!sourceIndex) return;
    tallydata_OBS.splice(sourceIndex, 1);
    logger(`OBS Tally Source: ${sourceId}  Source: ${name} removed`, 'info-quiet');
    //Note: currently will not delete the mapping from device_sources, in case its needed again?
}

function processOBSTally(sourceId, sourceArray, tallyType) {
	for (let i = 0; i < sourceArray.length; i++) {
        addOBSSource(sourceId,sourceArray[i].name);
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

		if ((tallydata_OBS[i].address !== '{{STREAMING}}') && (tallydata_OBS[i].address !== '{{RECORDING}}')) {
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
}

function StopOBSServer(sourceId) {
	let source = GetSourceBySourceId(sourceId);

	RegisterDisconnect(sourceId);

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
					source_connections[i].server.write('SUBSCRIBE ACTS\r\n');

					addVMixSource(sourceId, '{{RECORDING}}', 'Recording');
					addVMixSource(sourceId, '{{STREAMING}}', 'Streaming');

					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = true;
							UnregisterReconnect(sources[j].id);
							break;
						}
					}
					UpdateSockets('sources');
					UpdateCloud('sources');
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
							addVMixSource(sourceId, tallyObj.address, tallyObj.label);
						}
					}
					else {
						//we received some other command, so lets process it
						if (data[0].indexOf('ACTS OK Recording ') > -1) {
							let value = false;
							if (data.indexOf('ACTS OK Recording 1') > -1) {
								value = true;
							}
							//build an object like the TSL module creates so we can use the same function to process it
							let tallyObj = {};
							tallyObj.address = '{{RECORDING}}';
							tallyObj.brightness = 1;
							tallyObj.tally1 = 0;
							tallyObj.tally2 = value;
							tallyObj.tally3 = 0;
							tallyObj.tally4 = 0;
							tallyObj.label = `Recording: ${value}`;
							processTSLTally(sourceId, tallyObj);
						}

						if (data[0].indexOf('ACTS OK Streaming ') > -1) {
							let value = false;
							if (data.indexOf('ACTS OK Streaming 1') > -1) {
								value = true;
							}
							//build an object like the TSL module creates so we can use the same function to process it
							let tallyObj = {};
							tallyObj.address = '{{STREAMING}}';
							tallyObj.brightness = 1;
							tallyObj.tally1 = 0;
							tallyObj.tally2 = value;
							tallyObj.tally3 = 0;
							tallyObj.tally4 = 0;
							tallyObj.label = `Streaming: ${value}`;
							processTSLTally(sourceId, tallyObj);
						}
					}
				});

				source_connections[i].server.on('error', function(error) {
					logger(`Source: ${source.name}  VMix Connection Error occurred: ${error}`, 'error');
				});

				source_connections[i].server.on('close', function () {
					logger(`Source: ${source.name}  VMix Connection closed.`, 'info');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = false;
							CheckReconnect(sources[j].id);
							break;
						}
					}
					UpdateSockets('sources');
					UpdateCloud('sources');
				});
				break;
			}
		}
	}
	catch (error) {
		logger(`Source: ${source.name}. VMix Error Occurred: ${error}`, 'error');
	}
}

function addVMixSource(sourceId, address, label) {
    //Double check its not there already
    var exists = tallydata_VMix.find(function(src){
        return (src.sourceId == sourceId && src.address == address);
	});
	
    if (exists !== undefined) return;
	
	//Doesn't exist, add it
    tallydata_VMix.push({
        sourceId: sourceId,
        label: label,
        address: address,
        tally1: 0,
        tally2: 0,
        tally3: 0,
        tally4: 0
	});
	
    logger(`VMix Tally Source: ${sourceId} Added new source: ${label}`, 'info-quiet');
}

function StopVMixServer(sourceId) {
	let source = GetSourceBySourceId(sourceId);

	RegisterDisconnect(sourceId);

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

	try {
		let sourceConnectionObj = {};
		sourceConnectionObj.sourceId = sourceId;
		sourceConnectionObj.server = null;
		source_connections.push(sourceConnectionObj);

		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				logger(`Source: ${source.name}  Opening Roland Smart Tally connection.`, 'info-quiet');
				for (let j = 0; j < sources.length; j++) {
					if (sources[j].id === sourceId) {
						sources[j].connected = true;
						UnregisterReconnect(sources[j].id);
						break;
					}
				}
				source_connections[i].server = setInterval(checkRolandStatus, 500, sourceId);
				break;
			}
		}

		UpdateSockets('sources');
		UpdateCloud('sources');
	}
	catch (error) {
		logger(`Source: ${source.name}. Roland Smart Tally Error: ${error}`, 'error');
	}
}

function checkRolandStatus(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);
	let ip = source.data.ip;

	for (let j = 0; j < device_sources.length; j++) {
		if (device_sources[j].sourceId === sourceId) {
			let address = device_sources[j].address;
			axios.get(`http://${ip}/tally/${address}/status`)
			.then(function (response) {
				let tallyObj = {};
				tallyObj.address = address;
				tallyObj.label = address;
				tallyObj.tally4 = 0;
				tallyObj.tally3 = 0;
				tallyObj.tally2 = 0;
				tallyObj.tally1 = 0;

				switch(response.data)
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

	UpdateSockets('sources');
	UpdateCloud('sources');
}

function SetUpRolandVR(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);
	let ip = source.data.ip;
	let port = 8023;

	try
	{
		let sourceConnectionObj = {};
		sourceConnectionObj.sourceId = sourceId;
		sourceConnectionObj.server = null;
		source_connections.push(sourceConnectionObj);

		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				logger(`Source: ${source.name}  Creating Roland VR Connection.`, 'info-quiet');
				source_connections[i].server = new net.Socket();
				source_connections[i].server.connect({port: port, host: ip}, function() {
					let tallyCmd = '\u0002CPG:1;';
					source_connections[i].server.write(tallyCmd + '\n');
					logger(`Source: ${source.name}  Roland VR Connection opened. Listening for data.`, 'info');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = true;
							UnregisterReconnect(sources[j].id);
							break;
						}
					}
					UpdateSockets('sources');
					UpdateCloud('sources');
				});

				source_connections[i].server.on('data', function(data) {
					try {
						let dataString = data.toString();
						if (dataString.indexOf('\u0002QPG:') > -1) {
							//clear out any old tally values
							for (let j = 0; j <= 4; j++) {
								let tallyObj = {};
								tallyObj.address = j;
								tallyObj.label = j;
								tallyObj.tally1 = 0;
								tallyObj.tally2 = 0;
								processTSLTally(sourceId, tallyObj);
							}
							//now enter the new PGM value based on the received data
							let tallyObj = {};
							tallyObj.address = dataString.substring(dataString.length - 1, dataString.length - 2);
							switch(tallyObj.address) {
								case '0':
									tallyObj.label = 'INPUT 1';
									break;
								case '1':
									tallyObj.label = 'INPUT 2';
									break;
								case '2':
									tallyObj.label = 'INPUT 3';
									break;
								case '3':
									tallyObj.label = 'INPUT 4';
									break;
								case '4':
									tallyObj.label = 'STILL';
									break;
								default:
									tallyObj.label = tallyObj.address;
									break;
							}
							tallyObj.tally1 = 0;
							tallyObj.tally2 = 1;
							processTSLTally(sourceId, tallyObj);
						}
					}
					catch(error) {
						logger(`Source: ${source.name}  Roland VR Connection Error occurred: ${error}`, 'error');
					}
				});

				source_connections[i].server.on('close', function() {

					logger(`Source: ${source.name}  Roland VR Connection Stopped.`, 'info');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = false;
							CheckReconnect(sources[j].id);
							break;
						}
					}

					UpdateSockets('sources');
					UpdateCloud('sources');
				});

				source_connections[i].server.on('error', function(error) {
					logger(`Source: ${source.name}  Roland VR Connection Error occurred: ${error}`, 'error');
				});
				break;
			}
		}
	}
	catch (error) {
		logger(`Source: ${source.name}  Roland VR Error occurred: ${error}`, 'error');
	}
}

function StopRolandVR(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);

	RegisterDisconnect(sourceId);

	try
	{
		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				source_connections[i].server.end();
				source_connections[i].server.destroy();
				break;
			}
		}
	}
	catch (error) {
		logger(`Source: ${source.name}  Roland VR Connection Error occurred: ${error}`, 'error');
	}
}

function SetUpRossCarbonite(sourceId)
{
	let source = sources.find( ({ id }) => id === sourceId);
	let port = source.data.port;
	let transport = source.data.transport_type;

	if (transport === 'udp') {
		try
		{
			let sourceConnectionObj = {};
			sourceConnectionObj.sourceId = sourceId;
			sourceConnectionObj.server = null;
			source_connections.push(sourceConnectionObj);
	
			for (let i = 0; i < source_connections.length; i++) {
				if (source_connections[i].sourceId === sourceId) {
					AddPort(port, sourceId);
					logger(`Source: ${source.name}  Creating Ross Carbonite UDP Connection.`, 'info-quiet');
					source_connections[i].server = new TSLUMD(port);
	
					source_connections[i].server.on('message', function (tally) {
						processRossCarboniteTally(sourceId, tally);
					});
	
					logger(`Source: ${source.name}  Ross Carbonite Server started. Listening for data on UDP Port: ${port}`, 'info');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = true;
							break;
						}
					}
					UpdateSockets('sources');
					UpdateCloud('sources');
					break;
				}
			}
		} catch (error)
		{
			logger(`Source: ${source.name}  Ross Carbonite UDP Server Error occurred: ${error}`, 'error');
		}
	}
	else {
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
					logger(`Source: ${source.name}  Creating Ross Carbonite TCP Connection.`, 'info-quiet');
					source_connections[i].server = net.createServer(function (socket) {
						socket.on('data', function (data) {
							parser.extract('tsl', function (result) {
								result.label = Buffer.from(result.label).toString();
								processRossCarboniteTally(sourceId, result);
							});
							parser.parse(data);
						});
	
						socket.on('close', function () {
							logger(`Source: ${source.name}  Ross Carbonite TCP Server connection closed.`, 'info');
							CheckReconnect(source.id);
						});
					}).listen(port, function() {
						logger(`Source: ${source.name}  Ross Carbonite Server started. Listening for data on TCP Port: ${port}`, 'info');
						for (let j = 0; j < sources.length; j++) {
							if (sources[j].id === sourceId) {
								sources[j].connected = true;
								UnregisterReconnect(sources[j].id);
								break;
							}
						}
						UpdateSockets('sources');
						UpdateCloud('sources');
	
					});
					break;
				}
			}
		}
		catch (error) {
			logger(`Source: ${source.name}  Ross Carbonite TCP Server Error occurred: ${error}`, 'error');
		}
	}
}

function processRossCarboniteTally(sourceId, tallyObj) {
	let labelAddress = parseInt(tallyObj.label.substring(0, tallyObj.label.indexOf(':')));

	if (!isNaN(labelAddress)) {
		//if it's a number, then the address in the label field is the "real" tally address we care about
		labelAddress = labelAddress.toString(); //convert it to a string since all other addresses are stored as strings
		addRossCarboniteTally(sourceId, tallyObj.address.toString(), labelAddress);
	}
	else {
		//if it's not a number, then process the normal tally address
		for (let i = 0; i < device_sources.length; i++) {
			if (device_sources[i].sourceId === sourceId) { //this device_source is associated with the tally data of this source
				if (device_sources[i].address === tallyObj.address.toString()) { //this device_source's address matches what was in the address field
					if (device_sources[i].bus === 'onair') {
						if (tallyObj.tally1) {
							addRossCarboniteTally(sourceId, 'onair_preview', tallyObj.address.toString());
						}
						else {
							removeRossCarboniteTally(sourceId, 'onair_preview', tallyObj.address.toString());
						}
						if (tallyObj.tally2) {
							addRossCarboniteTally(sourceId, 'onair_program', tallyObj.address.toString());
						}
						else {
							removeRossCarboniteTally(sourceId, 'onair_program', tallyObj.address.toString());
						}
					}
				}
			}
		}
	}
}

function addRossCarboniteTally(sourceId, busAddress, address) {
	let found = false;

	for (let i = 0; i < tallydata_RossCarbonite.length; i++) {
		if (tallydata_RossCarbonite[i].sourceId === sourceId) {
			if (tallydata_RossCarbonite[i].address === address) {
				found = true;
				if (!tallydata_RossCarbonite[i].busses.includes(busAddress)) {
					tallydata_RossCarbonite[i].busses.push(busAddress); //add the bus address to this item
					updateRossCarboniteTallyData(sourceId, tallydata_RossCarbonite[i].address);
				}
			}
			else {
				if (tallydata_RossCarbonite[i].busses.includes(busAddress)) {
					//remove this bus from this entry, as it is no longer in it (the label field can only hold one entry at a time)
					if ((busAddress !== 'onair_preview') && (busAddress !== 'onair_program')) {
						removeRossCarboniteTally(sourceId, busAddress, tallydata_RossCarbonite[i].address);
					}
				}
			}
		}
	}

	if (!found) { //if there was not an entry in the array for this address
		let tallyObj = {};
		tallyObj.sourceId = sourceId;
		tallyObj.busses = [busAddress];
		tallyObj.address = address;
		tallydata_RossCarbonite.push(tallyObj);
	}
}

function removeRossCarboniteTally(sourceId, busAddress, address) {
	for (let i = 0; i < tallydata_RossCarbonite.length; i++) {
		if (tallydata_RossCarbonite[i].sourceId === sourceId) {
			if (tallydata_RossCarbonite[i].address === address) {
				tallydata_RossCarbonite[i].busses = tallydata_RossCarbonite[i].busses.filter(bus => bus !== busAddress);
				updateRossCarboniteTallyData(sourceId, tallydata_RossCarbonite[i].address);
			}
		}
	}
}

function updateRossCarboniteTallyData(sourceId, address) {
	//build a new TSL tally obj based on this address and whatever busses it might be in
	let source = GetSourceBySourceId(sourceId);
	let sourceTypeId = source.sourceTypeId;

	let inPreview = false;
	let inProgram = false;

	let found = false;

	for (let i = 0; i < device_sources.length; i++) {
		inPreview = false;
		inProgram = false;
		if (device_sources[i].sourceId === sourceId) {
			if (device_sources[i].address === address) {
				//this device_source has this address in it, so let's loop through the tallydata_carbonite array
				//   and find all the busses that match this address
				let busses = tallydata_RossCarbonite.find( ({address}) => address === device_sources[i].address).busses;

				for (let j = 0; j < busses.length; j++) {
					let bus = source_types_busaddresses.find( (busAddress) => {
							if ((busAddress.sourceTypeId === sourceTypeId) && (busAddress.address === busses[j])) {
								return true;
							}
						});
					if (bus) { //if bus is undefined, it's not a bus we monitor anyways
						if (bus.bus === device_sources[i].bus) {
							if (bus.type === 'preview') {
								inPreview = true;
							}
							else if (bus.type === 'program') {
								inProgram = true;
							}
						}
					}
				}

				let newTallyObj = {};
				newTallyObj.address = address;
				newTallyObj.tally1 = (inPreview ? 1 : 0);
				newTallyObj.tally2 = (inProgram ? 1 : 0);
				CheckDeviceState(device_sources[i].deviceId, sourceId, newTallyObj);
			}
		}
	}
}

function StopRossCarbonite(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);

	let transport = source.data.transport_type;

	if (transport === 'udp') {
		try
		{
			for (let i = 0; i < source_connections.length; i++) {
				if (source_connections[i].sourceId === sourceId) {
					logger(`Source: ${source.name}  Closing Ross Carbonite UDP Connection.`, 'info-quiet');
					source_connections[i].server.server.close();
					DeletePort(source.data.port);
					logger(`Source: ${source.name}  Ross Carbonite UDP Server Stopped. Connection Closed.`, 'info');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = false;
							break;
						}
					}
	
					UpdateSockets('sources');
					UpdateCloud('sources');
					break;
				}
			}
		}
		catch (error) {
			logger(`Source: ${source.name}  Ross Carbonite UDP Server Error occurred: ${error}`, 'error');
		}
	}
	else {
		RegisterDisconnect(sourceId);

		try
		{
			for (let i = 0; i < source_connections.length; i++) {
				if (source_connections[i].sourceId === sourceId) {
					source_connections[i].server.close(function() {});
					DeletePort(source.data.port);
					logger(`Source: ${source.name}  Ross Carbonite TCP Server Stopped.`, 'info');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = false;
							break;
						}
					}

					UpdateSockets('sources');
					UpdateCloud('sources');
					break;
				}
			}
		}
		catch (error) {
			logger(`Source: ${source.name}  Ross Carbonite TCP Server Error occurred: ${error}`, 'error');
		}
	}
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
						case '/tally/previewprogram_off':
							tallyObj.tally1 = 0;
							tallyObj.tally2 = 0;
							break;
						case '/tally/previewprogram_on':
							tallyObj.tally1 = 1;
							tallyObj.tally2 = 1;
							break;
						default:
							break;
					}
					processTSLTally(source.id, tallyObj);
				});

				source_connections[i].server.on('error', function (error) {
					logger(`Source: ${source.name} OSC Error: ${error}`, 'error');
				});

				source_connections[i].server.on('ready', function () {
					logger(`Source: ${source.name}  OSC port ${source.data.port} ready.`, 'info-quiet');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = true;
							UpdateSockets('sources');
							UpdateCloud('sources');
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

	UpdateSockets('sources');
	UpdateCloud('sources');
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
							UnregisterReconnect(sources[j].id);
							break;
						}
					}
					UpdateSockets('sources');
					UpdateCloud('sources');
				});

				source_connections[i].server.on('data', function(data) {
					try {
						data = '<data>' + data.toString() + '</data>';

						let parseString = xml2js.parseString;

						parseString(data, function (error, result) {
							if (error) {
								//the Tricaster will send a lot of data that will not parse correctly when it first connects
								//console.log('error:' + error);
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
							CheckReconnect(sources[j].id);
							break;
						}
					}

					UpdateSockets('sources');
					UpdateCloud('sources');
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

	RegisterDisconnect(sourceId);

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

function SetUpAWLivecoreServer(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);
	let ip = source.data.ip;
	let port = source.data.port;

	try
	{
		let sourceConnectionObj = {};
		sourceConnectionObj.sourceId = sourceId;
		sourceConnectionObj.server = null;
		source_connections.push(sourceConnectionObj);

		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				logger(`Source: ${source.name}  Creating AW Livecore connection.`, 'info-quiet');
				source_connections[i].server = new net.Socket();
				source_connections[i].server.connect(port, ip, function() {
					logger(`Source: ${source.name}  AW Livecore Connection Opened.`, 'info');
					source_connections[i].server.write('?\n');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = true;
							UnregisterReconnect(sources[j].id);
							break;
						}
					}
					UpdateSockets('sources');
					UpdateCloud('sources');

					source_connections[i].last_heartbeat = Date.now();
					source_connections[i].heartbeat_interval = setInterval(function(sourceId, connection) {
						if(Date.now() - connection.last_heartbeat > 5000) {
							for (let i = 0; i < source_connections.length; i++) {
								if (source_connections[i].sourceId === sourceId) {
									clearInterval(source_connections[i].heartbeat_interval);
									source_connections[i].server.end();
									source_connections[i].server.destroy();
									CheckReconnect(sourceId);
									break;
								}
							}
						} else {
							connection.server.write('PCdgs\n');
						}
					}, 1000, sourceId, source_connections[i]);
				});

				source_connections[i].server.on('data', function (data) {
					//logger(`Source: ${source.name}  AW Livecore data received.`, 'info-quiet');
					data = data
					.toString()
					.split(/\r?\n/);

					deviceState = data.filter(text => text.startsWith('PCdgs'));
					deviceData = data.filter(text => text.startsWith('DEV'));
					tallyProgramData = data.filter(text => text.startsWith('TAopr'));
					tallyPreviewData = data.filter(text => text.startsWith('TAopw'));

					if (deviceState.length > 0) {
						for (let i = 0; i < source_connections.length; i++) {
							if (source_connections[i].sourceId === sourceId) {
								source_connections[i].last_heartbeat = Date.now();
								//let state = deviceState[0].substring(5);
								//logger(`Source: ${source.name}  AW Livecore state: ` + state, 'info-quiet');
							}
						}
					}

					if (tallyProgramData.length > 0) {
						logger(`Source: ${source.name}  AW Livecore tally program data received.`, 'info-quiet');

						let address = tallyProgramData[0].substring(5, tallyProgramData[0].indexOf(','));
						let value = tallyProgramData[0].charAt(tallyProgramData[0].indexOf(',') + 1);

						let tallyObj = {};
						tallyObj.address = address.toString();
						tallyObj.tally2 = ((value === '1') ? 1 : 0); // Program
						tallyObj.label = `Input ${address}`;
						processAWLivecoreTally(sourceId, tallyObj);
					}

					if (tallyPreviewData.length > 0) {
						logger(`Source: ${source.name}  AW Livecore tally preview data received.`, 'info-quiet');

						let address = tallyPreviewData[0].substring(5, tallyPreviewData[0].indexOf(','));
						let value = tallyPreviewData[0].charAt(tallyPreviewData[0].indexOf(',') + 1);

						let tallyObj = {};
						tallyObj.address = address.toString();
						tallyObj.tally1 = ((value === '1') ? 1 : 0); // Preview
						tallyObj.label = `Input ${address}`;
						processAWLivecoreTally(sourceId, tallyObj);
					}

					if (deviceData.length > 0) {
						let deviceType = deviceData[0].substring(3);
						let deviceName = null;

						switch(deviceType) {
							case '97':
								deviceName = 'ORX_1 NeXtage 16';
								break;
							case '98':
								deviceName = 'ORX_2 SmartMatriX Ultra';
								break;
							case '99':
								deviceName = 'ORX_3 Ascender 32';
								break;
							case '100':
								deviceName = 'ORX_4 Ascender 48';
								break;
							case '102':
								deviceName = 'LOE_16 Output Expander 16';
								break;
							case '103':
								deviceName = 'LOE_32 Output Expander 32';
								break;
							case '104':
								deviceName = 'LOE_48 Output Expander 48';
								break;
							case '105':
								deviceName = 'NXT1604_4K NeXtage 16 4K';
								break;
							case '106':
								deviceName = 'SMX12x4_4K SmartMatrix Ultra 4K';
								break;
							case '107':
								deviceName = 'ASC3204_4K Ascender 32 4K';
								break;
							case '108':
								deviceName = 'ASC4806_4K Ascender 48 4K';
								break;
							case '109':
								deviceName = 'LOE016_4K Ouput Expander 16 4K';
								break;
							case '110':
								deviceName = 'LOE032_4K Ouput Expander 32 4K';
								break;
							case '111':
								deviceName = 'LOE048_4K Ouput Expander 48 4K';
								break;
							case '112':
								deviceName = 'ASC016 Ascender 16';
								break;
							case '113':
								deviceName = 'ASC016_4K Ascender 16 4K';
								break;
							case '114':
								deviceName = 'ASC048_PL Ascender 48 4K PL';
								break;
							case '115':
								deviceName = 'LOE48_PL Ouput Expander 48 4K PL';
								break;
							case '116':
								deviceName = 'NXT0802 NeXtage 8';
								break;
							case '117':
								deviceName = 'NXT0802_4K NeXtage 8 4K';
								break;
							case '118':
								deviceName = 'ASC032_PL Ascender 32 4K PL';
								break;
							case '119':
								deviceName = 'LOE032_PL Ouput Expander 32 4K PL';
								break;
							default:
								deviceName = 'Unknown device';
								break;
						}
						logger('AW device type: ' + deviceType + ' (' + deviceName + ')', 'info-quiet');
					}
				});

				source_connections[i].server.on('close', function () {
					logger(`Source: ${source.name}  AW Livecore Connection closed.`, 'info');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = false;
							CheckReconnect(sources[j].id);
							break;
						}
					}
					UpdateSockets('sources');
					UpdateCloud('sources');
				});

				break;
			}
		}
	}
	catch (error) {
		logger(`Source: ${source.name}. AW Livecore Error Occurred: ${error}`, 'error');
	}
}

function StopAWLivecoreServer(sourceId) {
	let source = GetSourceBySourceId(sourceId);

	RegisterDisconnect(sourceId);

	try {
		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				logger(`Source: ${source.name}  Closing AW Livecore connection.`, 'info-quiet');
				clearInterval(source_connections[i].heartbeat_interval);
				source_connections[i].server.end();
				source_connections[i].server.destroy();
				break;
			}
		}
	}
	catch (error) {
		logger(`Source: ${source.name}  AW Livecore Connection Error occurred: ${error}`, 'error');
	}
}

function processAWLivecoreTally(sourceId, tallyObj) {
	let AWLivecoreSourceFound = false;
	for (let j = 0; j < tallydata_AWLivecore.length; j++) {
		if (tallydata_AWLivecore[j].sourceId === sourceId) {
			if (tallydata_AWLivecore[j].address === tallyObj.address) {
				AWLivecoreSourceFound = true;
				break;
			}
		}
	}

	if (!AWLivecoreSourceFound) {
		//the source is not in the AWLivecore array, we don't know anything about it, so add it to the array
		let newTallyObj = {};
		newTallyObj.sourceId = sourceId;
		newTallyObj.label = tallyObj.label;
		newTallyObj.address = tallyObj.address;
		newTallyObj.tally4 = 0;
		newTallyObj.tally3 = 0;
		newTallyObj.tally2 = 0; // PGM
		newTallyObj.tally1 = 0; // PVW
		tallydata_AWLivecore.push(newTallyObj);
	}

	for (let i = 0; i < tallydata_AWLivecore.length; i++) {
		if (tallydata_AWLivecore[i].sourceId === sourceId) {
			if (tallydata_AWLivecore[i].address === tallyObj.address) {
				if(tallyObj.tally1 !== undefined) { // PVW
					tallydata_AWLivecore[i].tally1 = tallyObj.tally1;
				}
				if(tallyObj.tally2 !== undefined) { // PGM
					tallydata_AWLivecore[i].tally2 = tallyObj.tally2;
				}

				let processedTallyObj =  Object.assign({}, tallydata_AWLivecore[i]);
				if(processedTallyObj.tally2 === 1) { // PGM
					processedTallyObj.tally1 = 0;
				}

				processTSLTally(sourceId, processedTallyObj);
				break;
			}
		}
	}
}

function processTSLTally(sourceId, tallyObj) // Processes the TSL Data
{
	//logger(`Processing new tally object.`, 'info-quiet');

	io.to('settings').emit('tally_data', sourceId, tallyObj);

	let deviceId = null;

	for (let i = 0; i < device_sources.length; i++) {
		if ((device_sources[i].sourceId === sourceId) && (device_sources[i].address === tallyObj.address.toString())) {
			deviceId = device_sources[i].deviceId;
			CheckDeviceState(deviceId, sourceId, tallyObj);
		}
	}
}

function CheckDeviceState(deviceId, sourceId, tallyObj) {
	let busId_preview = null;
	let busId_program = null;

	for (let i = 0; i < bus_options.length; i++) {
		switch(bus_options[i].type) {
			case 'preview':
				busId_preview = bus_options[i].id;
				break;
			case 'program':
				busId_program = bus_options[i].id;
				break;
			default:
				break;
		}
	}

	if (deviceId !== null) {
		//do something with the device given the current state
		let device = GetDeviceByDeviceId(deviceId);

		for (let i = 0; i < device_states.length; i++) {
			if (typeof device_states[i].linkedSources === 'undefined') {
				device_states[i].linkedSources = [];
			}

			if (device_states[i].deviceId === deviceId) {
				if (device_states[i].busId === busId_preview) {
					if (device.linkedPreview) {
						//the preview bus is linked across device sources, so add this tally information to the linkedSources array
						let sourceAddressFound = false;
						for (let j = 0; j < device_states[i].linkedSources.length; j++) {
							if (device_states[i].linkedSources[j].sourceId === sourceId) {
								if (device_states[i].linkedSources[j].address === tallyObj.address) {
									sourceAddressFound = true;
									if (!tallyObj.tally1) {
										device_states[i].linkedSources.splice(j, 1);
									}
								}
							}
						}
	
						if (!sourceAddressFound) {
							if (tallyObj.tally1) {
								//add it, it's not already in preview on this source and address
								let sourceObj = {};
								sourceObj.sourceId = sourceId;
								sourceObj.address = tallyObj.address;
								device_states[i].linkedSources.push(sourceObj);
							}
						}

						//now check and see if linkedSources should be pushed to sources
						let devSources = GetDeviceSourcesByDeviceId(deviceId);
						let sourcesLength = devSources.length;
						let linkedSourcesLength = device_states[i].linkedSources.length;

						if (sourcesLength === linkedSourcesLength) { //all source mappings are in this bus, so copy them over to the actual sources array now for processing
							device_states[i].sources = device_states[i].linkedSources;
						}
						else {
							device_states[i].sources = [];
						}
					}
					else {
						let sourceAddressFound = false;
						for (let j = 0; j < device_states[i].sources.length; j++) {
							if (device_states[i].sources[j].sourceId === sourceId) {
								if (device_states[i].sources[j].address === tallyObj.address) {
									sourceAddressFound = true;
									if (!tallyObj.tally1) {
										device_states[i].sources.splice(j, 1);
									}
								}
							}
						}
	
						if (!sourceAddressFound) {
							if (tallyObj.tally1) {
								//add it, it's not already in preview on this source and address
								let sourceObj = {};
								sourceObj.sourceId = sourceId;
								sourceObj.address = tallyObj.address;
								device_states[i].sources.push(sourceObj);
							}
						}
					}
				}

				if (device_states[i].busId === busId_program) {
					if (device.linkedProgram) {
						//the program bus is linked across device sources, so add this tally information to the linkedSources array
						let sourceAddressFound = false;
						for (let j = 0; j < device_states[i].linkedSources.length; j++) {
							if (device_states[i].linkedSources[j].sourceId === sourceId) {
								if (device_states[i].linkedSources[j].address === tallyObj.address) {
									sourceAddressFound = true;
									if (!tallyObj.tally2) {
										device_states[i].linkedSources.splice(j, 1);
									}
								}
							}
						}
	
						if (!sourceAddressFound) {
							if (tallyObj.tally2) {
								//add it, it's not already in preview on this source and address
								let sourceObj = {};
								sourceObj.sourceId = sourceId;
								sourceObj.address = tallyObj.address;
								device_states[i].linkedSources.push(sourceObj);
							}
						}

						//now check and see if linkedSources should be pushed to sources
						let devSources = GetDeviceSourcesByDeviceId(deviceId);
						let sourcesLength = devSources.length;
						let linkedSourcesLength = device_states[i].linkedSources.length;

						if (sourcesLength === linkedSourcesLength) { //all source mappings are in this bus, so copy them over to the actual sources array now for processing
							device_states[i].sources = device_states[i].linkedSources;
						}
						else {
							device_states[i].sources = [];
						}
					}
					else {
						let sourceAddressFound = false;
						for (let j = 0; j < device_states[i].sources.length; j++) {
							if (device_states[i].sources[j].sourceId === sourceId) {
								if (device_states[i].sources[j].address === tallyObj.address) {
									sourceAddressFound = true;
									if (!tallyObj.tally2) {
										device_states[i].sources.splice(j, 1);
									}
								}
							}
						}

						if (!sourceAddressFound) {
							if (tallyObj.tally2) {
								//add it, it's not already in preview on this source and address
								let sourceObj = {};
								sourceObj.sourceId = sourceId;
								sourceObj.address = tallyObj.address;
								device_states[i].sources.push(sourceObj);
							}
						}
					}
				}
			}
		}

		UpdateDeviceState(deviceId); //Runs any outgoing actions for the device, if needed
		UpdateSockets('device_states');
		UpdateVMixClients();
		SendTSLClientData(deviceId);
		SendCloudData(sourceId, tallyObj);
	}
}

function UpdateDeviceState(deviceId) {
	let busId_preview = null;
	let busId_program = null;

	for (let i = 0; i < bus_options.length; i++) {
		switch(bus_options[i].type) {
			case 'preview':
				busId_preview = bus_options[i].id;
				break;
			case 'program':
				busId_program = bus_options[i].id;
				break;
			default:
				break;
		}
	}

	let device = GetDeviceByDeviceId(deviceId);
	let deviceSources = GetDeviceSourcesByDeviceId(deviceId);

	for (let i = 0; i < device_states.length; i++) {
		if (device_states[i].deviceId === deviceId) {
			if (device_states[i].busId === busId_preview) {
				if ((device_states[i].sources.length > 0) && (!device_states[i].active)) {
					//if the sources list is now greater than zero and the state is not already marked active for this device, run the action and make it active
					//but first check if the device sources are linked; if they are, make sure all device sources are in this bus
					if (device.linkedPreview) {
						//check
						if (device_states[i].linkedSources.length === deviceSources.length) {
							//if the lengths are the same, then the device states match the device source mappings
							RunAction(deviceId, device_states[i].busId, true);
							device_states[i].active = true;
						}
					}
					else {
						//not linked, so run the action
						RunAction(deviceId, device_states[i].busId, true);
						device_states[i].active = true;
					}
				}
				else if ((device_states[i].sources.length < 1) && (device_states[i].active)) {
					//if the source list is now zero and the state is marked active, run the action and make it inactive
					//but first check if the device sources are linked; if they are, make sure all device sources are in this bus
					if (device.linkedPreview) {
						//check
						if (device_states[i].linkedSources.length === deviceSources.length) {
							//if the lengths are the same, then the device states match the device source mappings
							RunAction(deviceId, device_states[i].busId, false);
							device_states[i].active = false;	
						}
					}
					else {
						//not linked, so run the action
						RunAction(deviceId, device_states[i].busId, false);
						device_states[i].active = false;
					}
				}
			}
			else if (device_states[i].busId === busId_program) {
				if ((device_states[i].sources.length > 0) && (!device_states[i].active)) {
					//if the sources list is now greater than zero and the state is not already marked active for this device, run the action and make it active
					//but first check if the device sources are linked; if they are, make sure all device sources are in this bus
					if (device.linkedProgram) {
						//check
						if (device_states[i].linkedSources.length === deviceSources.length) {
							//if the lengths are the same, then the device states match the device source mappings
							RunAction(deviceId, device_states[i].busId, true);
							device_states[i].active = true;
						}
					}
					else {
						//not linked, so run the action
						RunAction(deviceId, device_states[i].busId, true);
						device_states[i].active = true;
					}
				}
				else if ((device_states[i].sources.length < 1) && (device_states[i].active)) {
					//if the source list is now zero and the state is marked active, run the action and make it inactive
					//but first check if the device sources are linked; if they are, make sure all device sources are in this bus
					if (device.linkedProgram) {
						//check
						if (device_states[i].linkedSources.length === deviceSources.length) {
							//if the lengths are the same, then the device states match the device source mappings
							RunAction(deviceId, device_states[i].busId, false);
							device_states[i].active = false;	
						}
					}
					else {
						//not linked, so run the action
						RunAction(deviceId, device_states[i].busId, false);
						device_states[i].active = false;
					}
				}
			}
		}
	}

	logger(`Sending device states for: ${device.name}`, 'info-quiet');
	io.to('device-' + deviceId).emit('device_states', GetDeviceStatesByDeviceId(deviceId));
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
						case 'tcp':
							RunAction_TCP(actionObj.data);
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
		let path = data.path ? (data.path.startsWith('/') ? data.path : '/' + data.path) : '';
		data.protocol = data.protocol || 'http://';

		data.port = data.port ? (data.port === '' ? '80' : data.port) : '80'; //explicitly set the port to 80 if they did not specify

		let options = {
			method: data.method,
			url: data.protocol + data.ip + ':' + data.port + path
		};

		options.headers = options.headers || {};

		data.contentType = data.contentType || '';
		if (data.contentType !== '') {
			options.headers['Content-Type'] = data.contentType;
		}
		
		if (data.method === 'POST') {
			if (data.postdata !== '') {
				options.data = data.postdata;
			}
		}

		logger('Outgoing Webhook Options:', 'info-quiet');
		logger(JSON.stringify(options), 'info-quiet')
		axios(options)
		.then(function (response) {
			logger('Outgoing Webhook triggered.', 'info');
			if (response.data) {
				logger('Response received:','info');
				logger(JSON.stringify(response.data),'info');
			}
		})
		.catch(function (error) {
			logger(`An error occured triggering the Outgoing Webhook: ${error}`, 'error');
		});
	}
	catch (error) {
		logger(`An error occured sending the Outgoing Webhook: ${error}`, 'error');
	}
}

function RunAction_TCP(data) {
	try {
		let tcpClient = new net.Socket();
		tcpClient.connect(data.port, data.ip);

		tcpClient.on('connect', function() {
			let sendBuf = Buffer.from(unescape(data.string) + data.end, 'latin1');
			if (sendBuf !== '') {
				tcpClient.write(sendBuf);
				tcpClient.end();
				tcpClient.destroy(); // kill client after sending data
				logger(`Generic TCP sent: ${data.ip}:${data.port} : ${data.string}`, 'info');
			}
		});

		tcpClient.on('error', function(error) {
			logger(`An error occured sending the Generic TCP: ${error}`, 'error');
		});
	}
	catch (error) {
		logger(`An error occured sending the Generic TCP: ${error}`, 'error');
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
		case 'cloud_destination':
			if (obj.action === 'add') {
				result = TallyArbiter_Add_Cloud_Destination(obj);
			}
			else if (obj.action === 'edit') {
				result = TallyArbiter_Edit_Cloud_Destination(obj);
			}
			else if (obj.action === 'delete') {
				result = TallyArbiter_Delete_Cloud_Destination(obj);
			}
			break;
		case 'cloud_key':
			if (obj.action === 'add') {
				result = TallyArbiter_Add_Cloud_Key(obj);
			}
			else if (obj.action === 'delete') {
				result = TallyArbiter_Delete_Cloud_Key(obj);
			}
			break;
		case 'cloud_client':
			if (obj.action === 'remove') {
				result = TallyArbiter_Remove_Cloud_Client(obj);
			}
			break;
		default:
				result = {result: 'error', error: 'Invalid API request.'}
			break;
	}

	SaveConfig();

	return result;
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
		case 'tsl_5_udp':
			SetUpTSL5Server_UDP(sourceId);
			break;
		case 'tsl_5_tcp':
			SetUpTSL5Server_TCP(sourceId);
			break;
		case 'atem':
			SetUpATEMServer(sourceId);
			break;
		case 'videohub':
			SetUpVideoHubServer(sourceId);
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
		case 'roland-vr':
			SetUpRolandVR(sourceId);
			break;
		case 'ross_carbonite':
			SetUpRossCarbonite(sourceId);
			break;
		case 'osc':
			SetUpOSCServer(sourceId);
			break;
		case 'tc':
			SetUpTricasterServer(sourceId);
			break;
		case 'awlivecore':
			SetUpAWLivecoreServer(sourceId);
			break;
		case 'testmode':
			EnableTestMode(true);
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
		case 'tsl_5_udp':
			StopTSL5Server_UDP(sourceId);
			break;
		case 'tsl_5_tcp':
			StopTSL5Server_TCP(sourceId);
			break;
		case 'atem':
			StopATEMServer(sourceId);
			break;
		case 'videohub':
			StopVideoHubServer(sourceId);
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
		case 'roland-vr':
			StopRolandVR(sourceId);
			break;
		case 'ross_carbonite':
			StopRossCarbonite(sourceId);
			break;
		case 'osc':
			StopOSCServer(sourceId);
			break;
		case 'tc':
			StopTricasterServer(sourceId);
			break;
		case 'awlivecore':
			StopAWLivecoreServer(sourceId);
			break;
		case 'testmode':
			EnableTestMode(false);
			break;
		default:
			break;
	}
}

function RegisterDisconnect(sourceId) {
	let found = false;

	for (let i = 0; i < source_reconnects.length; i++) {
		if (source_reconnects[i].sourceId === sourceId) {
			found = true;
		}
	}

	if (!found) {
		let reconnectObj = {};
		reconnectObj.sourceId = sourceId;
		reconnectObj.forcibly = true;
		source_reconnects.push(reconnectObj);
	}
}

function CheckReconnect(sourceId) {
	let source = GetSourceBySourceId(sourceId);

	if (source) {
		if (source.connected === false) {
			let found = false;
	
			for (let i = 0; i < source_reconnects.length; i++) {
				if (source_reconnects[i].sourceId === sourceId) {
					found = true;
					if (source_reconnects[i].forcibly !== true) {
						if (source_reconnects[i].attempts < 5) {
							source_reconnects[i].attempts = source_reconnects[i].attempts + 1;
							logger(`Attempting to reconnect to ${source.name} (${source_reconnects[i].attempts} of 5)`, 'info');
							StartConnection(sourceId);
							setTimeout(CheckReconnect, 5000, sourceId);
						}
					}
					break;
				}
			}
	
			if (!found) {
				let reconnectObj = {};
				reconnectObj.sourceId = sourceId;
				reconnectObj.forcibly = false;
				reconnectObj.attempts = 1;
				source_reconnects.push(reconnectObj);
				logger(`Attempting to reconnect to ${source.name} (${reconnectObj.attempts} of 5)`, 'info');
				StartConnection(sourceId);
				setTimeout(CheckReconnect, 5000, sourceId);
			}
		}
		else {
			UnregisterReconnect(sourceId);
		}
	}
}

function UnregisterReconnect(sourceId) {
	for (let i = 0; i < source_reconnects.length; i++) {
		if (source_reconnects[i].sourceId === sourceId) {
			source_reconnects.splice(i, 1);
			break;
		}
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
						UpdateSockets('tsl_clients');
					});
					tsl_clients[i].socket.on('connect', function() {
						logger(`TSL Client ${tslClientId} Connection Established: ${tsl_clients[i].ip}:${tsl_clients[i].port}`, 'info-quiet');
						tsl_clients[i].error = false;
						tsl_clients[i].connected = true;
						UpdateSockets('tsl_clients');
					});
					tsl_clients[i].socket.on('close', function() {
						logger(`TSL Client ${tslClientId} Connection Closed: ${tsl_clients[i].ip}:${tsl_clients[i].port}`, 'info-quiet');
						tsl_clients[i].error = false;
						tsl_clients[i].connected = false;
						UpdateSockets('tsl_clients');
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
						UpdateSockets('tsl_clients');
					});
					tsl_clients[i].socket.on('connect', function() {
						logger(`TSL Client ${tslClientId} Connection Established: ${tsl_clients[i].ip}:${tsl_clients[i].port}`, 'info-quiet');
						tsl_clients[i].error = false;
						tsl_clients[i].connected = true;
						UpdateSockets('tsl_clients');
					});
					tsl_clients[i].socket.on('close', function() {
						logger(`TSL Client ${tslClientId} Connection Closed: ${tsl_clients[i].ip}:${tsl_clients[i].port}`, 'info-quiet');
						tsl_clients[i].error = false;
						tsl_clients[i].connected = false;
						UpdateSockets('tsl_clients');
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

	let mode_preview = false;
	let mode_program = false;

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
				logger(`Sending TSL data for ${device.name} to ${tsl_clients[i].ip}:${tsl_clients[i].port}`, 'info');
				switch(tsl_clients[i].transport) {
					case 'udp':
						try {
							tsl_clients[i].socket.send(bufUMD, parseInt(tsl_clients[i].port), tsl_clients[i].ip);
						}
						catch(error) {
							logger(`An error occurred sending TSL data for ${device.name} to ${tsl_clients[i].ip}:${tsl_clients[i].port}  ${error}`, 'error');
							tsl_clients[i].error = true;
						}
						break;
					case 'tcp':
						try {
							tsl_clients[i].socket.write(bufUMD);
						}
						catch(error) {
							logger(`An error occurred sending TSL data for ${device.name} to ${tsl_clients[i].ip}:${tsl_clients[i].port}  ${error}`, 'error');
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

function TSLClients_1SecUpdate(value) {
	if (tsl_clients_interval !== null) {
		clearInterval(tsl_clients_interval);
	}

	logger(`TSL Clients 1 Second Updates are turned ${ (value ? 'on' : 'off')}.`, 'info');

	if (value) {
		logger('Starting TSL Clients 1 Second Interval.');
		tsl_clients_interval = setInterval(TSLClients_UpdateAll, 1000);
	}
}

function TSLClients_UpdateAll() {
	//loops through all devices and sends out the state, 1 per second
	for (let i = 0; i < devices.length; i++) {
		SendTSLClientData(devices[i].id);
	}
}

function StartCloudDestination(cloudDestinationId) {
	let cloud_destination = GetCloudDestinationById(cloudDestinationId);

	let cloudDestinationSocketObj = {};
	cloudDestinationSocketObj.id = cloudDestinationId;
	cloudDestinationSocketObj.socket = null;
	cloudDestinationSocketObj.host = cloud_destination.host;
	cloudDestinationSocketObj.port = cloud_destination.port;
	cloudDestinationSocketObj.key = cloud_destination.key;
	cloud_destinations_sockets.push(cloudDestinationSocketObj);

	for (let i = 0; i < cloud_destinations_sockets.length; i++) {
		if (cloud_destinations_sockets[i].id === cloudDestinationId) {
			logger(`Cloud Destination: ${cloud_destinations_sockets[i].host}:${cloud_destinations_sockets[i].port}  Initiating Connection.`, 'info-quiet');

			cloud_destinations_sockets[i].socket = ioClient('http://' + cloud_destinations_sockets[i].host + ':' + cloud_destinations_sockets[i].port, {reconnection: true});

			cloud_destinations_sockets[i].socket.on('connect', function() { 
				logger(`Cloud Destination: ${cloud_destinations_sockets[i].host}:${cloud_destinations_sockets[i].port} Connected. Sending Initial Data.`, 'info-quiet');
				cloud_destinations_sockets[i].connected = true;
				SetCloudDestinationStatus(cloud_destinations_sockets[i].id, 'connected');
				cloud_destinations_sockets[i].socket.emit('cloud_client', cloud_destinations_sockets[i].key);
				cloud_destinations_sockets[i].socket.emit('cloud_sources', cloud_destinations_sockets[i].key, sources);
				cloud_destinations_sockets[i].socket.emit('cloud_devices', cloud_destinations_sockets[i].key, devices);
				cloud_destinations_sockets[i].socket.emit('cloud_device_sources', cloud_destinations_sockets[i].key, device_sources);
				cloud_destinations_sockets[i].socket.emit('cloud_listeners', cloud_destinations_sockets[i].key, listener_clients);
			});

			cloud_destinations_sockets[i].socket.on('invalidkey', function () {
				cloud_destinations_sockets[i].error = true;
				logger(`An error occurred with the connection to ${cloud_destinations_sockets[i].host}:${cloud_destinations_sockets[i].port} : The specified key could not be found on the host: ${cloud_destinations_sockets[i].key}`, 'error');
				SetCloudDestinationStatus(cloud_destinations_sockets[i].id, 'invalid-key');
			});

			cloud_destinations_sockets[i].socket.on('flash', function (listenerClientId) {
				FlashListenerClient(listenerClientId);
			});

			cloud_destinations_sockets[i].socket.on('messaging_client', function (listenerClientId, type, socketid, message) {
				MessageListenerClient(listenerClientId, type, socketid, message);
			});

			cloud_destinations_sockets[i].socket.on('error', function(error) {
				logger(`An error occurred with the connection to ${cloud_destinations_sockets[i].host}:${cloud_destinations_sockets[i].port}  ${error}`, 'error');
				cloud_destinations[i].error = true;
				SetCloudDestinationStatus(cloud_destinations_sockets[i].id, 'error');
			});

			cloud_destinations_sockets[i].socket.on('disconnect', function() { 
				logger(`Cloud Connection Disconnected: ${cloud_destinations_sockets[i].host}:${cloud_destinations_sockets[i].port}`, 'error');
				cloud_destinations_sockets[i].connected = false;
				SetCloudDestinationStatus(cloud_destinations_sockets[i].id, 'disconnected');
			});

			break;
		}
	}
}

function StopCloudDestination(cloudDestinationId) {
	for (let i = cloud_destinations_sockets.length - 1; i >= 0; i--) {
		if (cloud_destinations_sockets[i].id === cloudDestinationId) {
			logger(`Cloud Destination: ${cloudDestinationId}  Closing Connection.`, 'info-quiet');
			try {
				cloud_destinations_sockets[i].socket.close();
			}
			catch (error) {
				logger(`Error Closing Cloud Destination ${cloudDestinationId}`, 'error');
			}
			cloud_destinations_sockets.splice(i, 1);
			break;
		}
	}
}

function SendCloudData(sourceId, tallyObj) {
	if (cloud_destinations.length > 0) {
		//logger(`Sending data to Cloud Destinations.`, 'info-quiet');
	}

	for (let i = 0; i < cloud_destinations_sockets.length; i++) {
		if (cloud_destinations_sockets[i].connected === true) {
			try {
				logger(`Sending data to Cloud Destination: ${cloud_destinations_sockets[i].host}:${cloud_destinations_sockets[i].port}`, 'info-quiet');
				cloud_destinations_sockets[i].socket.emit('cloud_data', cloud_destinations_sockets[i].key, sourceId, tallyObj);
			}
			catch(error) {
				logger(`An error occurred sending Cloud data to ${cloud_destinations_sockets[i].host}:${cloud_destinations_sockets[i].port}  ${error}`, 'error');
				cloud_destinations_sockets[i].error = true;
			}
		}
	}
}

function SetCloudDestinationStatus(cloudId, status) {
	for (let i = 0; i < cloud_destinations.length; i++) {
		if (cloud_destinations[i].id === cloudId) {
			cloud_destinations[i].status = status;
			break;
		}
	}

	UpdateSockets('cloud_destinations');
}

function UpdateCloud(dataType) {
	for (let i = 0; i < cloud_destinations_sockets.length; i++) {
		if (cloud_destinations_sockets[i].connected === true) {
			try {
				switch(dataType) {
					case 'sources':
						cloud_destinations_sockets[i].socket.emit('cloud_sources', cloud_destinations_sockets[i].key, sources);
						break;
					case 'devices':
						cloud_destinations_sockets[i].socket.emit('cloud_devices', cloud_destinations_sockets[i].key, devices);
						break;
					case 'device_sources':
						cloud_destinations_sockets[i].socket.emit('cloud_device_sources', cloud_destinations_sockets[i].key, device_sources);
						break;
					case 'listener_clients':
						cloud_destinations_sockets[i].socket.emit('cloud_listeners', cloud_destinations_sockets[i].key, listener_clients);
						break;
				}
			}
			catch(error) {
				logger(`An error occurred sending Cloud data to ${cloud_destinations_sockets[i].host}:${cloud_destinations_sockets[i].port}  ${error}`, 'error');
				cloud_destinations_sockets[i].error = true;
				SetCloudDestinationStatus(cloud_destinations_sockets[i].id, 'error');
			}
		}
	}
}

function UpdateSockets(dataType) {
	let emitSettings = false;
	let emitProducer =  false;

	if (socketupdates_Settings.includes(dataType)) {
		emitSettings = true;
	}

	if (socketupdates_Producer.includes(dataType)) {
		emitProducer = true;
	}

	if (socketupdates_Companion.includes(dataType)) {
		emitCompanion = true;
	}

	switch(dataType) {
		case 'sources':
			if (emitSettings) {
				io.to('settings').emit('sources', sources);
			}
			if (emitProducer) {
				io.to('producer').emit('sources', sources);
			}
			if (emitCompanion) {
				io.to('companion').emit('sources', sources);
			}
			break;
		case 'devices':
			if (emitSettings) {
				io.to('settings').emit('devices', devices);
			}
			if (emitProducer) {
				io.to('producer').emit('devices', devices);
			}
			if (emitCompanion) {
				io.to('companion').emit('devices', devices);
			}
			break;
		case 'device_sources':
			if (emitSettings) {
				io.to('settings').emit('device_sources', device_sources);
			}
			if (emitProducer) {
				io.to('producer').emit('device_sources', device_sources);
			}
			if (emitCompanion) {
				io.to('companion').emit('device_sources', device_sources);
			}
			break;
		case 'device_states':
			if (emitSettings) {
				io.to('settings').emit('device_states', device_states);
			}
			if (emitProducer) {
				io.to('producer').emit('device_states', device_states);
			}
			if (emitCompanion) {
				io.to('companion').emit('device_states', device_states);
			}
			break;
		case 'listener_clients':
			if (emitSettings) {
				io.to('settings').emit('listener_clients', listener_clients);
			}
			if (emitProducer) {
				io.to('producer').emit('listener_clients', listener_clients);
			}
			if (emitCompanion) {
				io.to('companion').emit('listener_clients', listener_clients);
			}
			break;
		case 'tsl_clients':
			if (emitSettings) {
				io.to('settings').emit('tsl_clients', tsl_clients);
			}
			if (emitProducer) {
				io.to('producer').emit('tsl_clients', tsl_clients);
			}
			if (emitCompanion) {
				io.to('companion').emit('tsl_clients', tsl_clients);
			}
			break;
		case 'cloud_destinations':
			if (emitSettings) {
				io.to('settings').emit('cloud_destinations', cloud_destinations);
			}
			if (emitCompanion) {
				io.to('companion').emit('cloud_destinations', cloud_destinations);
			}
			break;
		case 'cloud_clients':
			if (emitSettings) {
				io.to('settings').emit('cloud_clients', cloud_clients);
			}
			break;
		case 'PortsInUse':
			if (emitSettings) {
				io.to('settings').emit('tsl_clients', tsl_clients);
			}
			break;
		default:
			break;
	}
}

function UpdateVMixClients() {
	let vmixTallyString = 'TALLY OK ';

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
			default:
				break;
		}
	}

	for (let i = 0; i < devices.length; i++) {
		let deviceId = devices[i].id;

		let inPreview = false;
		let inProgram = false;

		for (let i = 0; i < device_states.length; i++) {
			if (device_states[i].deviceId === deviceId) {
				if (device_states[i].busId === busId_preview) {
					if (device_states[i].sources.length > 0) {
						inPreview = true;
					}
					else {
						inPreview = false;
					}
				}

				if (device_states[i].busId === busId_program) {
					if (device_states[i].sources.length > 0) {
						inProgram = true;
					}
					else {
						inProgram = false;
					}
				}
			}
		}

		if (inProgram) {
			vmixTallyString += '1';
		}
		else if (inPreview) {
			vmixTallyString += '2';
		}
		else {
			vmixTallyString += '0';
		}
	}

	vmixTallyString += '\r\n';

	for (let i = 0; i < vmix_clients.length; i++) {
		vmix_clients[i].write(vmixTallyString);
	}
}

function TallyArbiter_Add_Source(obj) {
	let sourceObj = obj.source;
	sourceObj.id = uuidv4();
	sources.push(sourceObj);

	UpdateCloud('sources');

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
			sources[i].reconnect = sourceObj.reconnect;
			sources[i].data = sourceObj.data;
			sourceTypeId = sources[i].sourceTypeId;
			connected = sources[i].connected;
		}
	}

	UpdateCloud('sources');

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
			sourceName = sources[i].name;
			if (sources[i].connected === true) {
				StopConnection(sourceId);
			}
			if (sourceId !== 'TEST') {
				sources.splice(i, 1);
			}
			break;
		}
	}

	UpdateCloud('sources');

	for (let i = device_sources.length - 1; i >= 0; i--) {
		if (device_sources[i].sourceId === sourceId) {
			device_sources.splice(i, 1);
		}
	}

	UpdateCloud('device_sources');

	for (let i = device_states.length - 1; i >=0; i--) {
		for (let j = device_states[i].sources.length - 1; j >=0; j--) {
			if (device_states[i].sources[j] === sourceId) {
				device_states[i].sources.splice(j, 1);
				break;
			}
		}
	}

	UpdateSockets('device_states');

	logger(`Source Deleted: ${sourceName}`, 'info');

	return {result: 'source-deleted-successfully'};
}

function TallyArbiter_Add_Device(obj) {
	let deviceObj = obj.device;
	deviceObj.id = uuidv4();
	devices.push(deviceObj);

	UpdateCloud('devices');

	let busId_preview = null;
	let busId_program = null;

	for (let i = 0; i < bus_options.length; i++) {
		switch(bus_options[i].type) {
			case 'preview':
				busId_preview = bus_options[i].id;
				break;
			case 'program':
				busId_program = bus_options[i].id;
				break;
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

	UpdateCloud('devices');

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

	UpdateCloud('devices');

	for (let i = device_sources.length - 1; i >= 0; i--) {
		if (device_sources[i].deviceId === deviceId) {
			device_sources.splice(i, 1);
		}
	}

	UpdateCloud('device_sources');

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

	UpdateCloud('device_sources');

	logger(`Device Source Added: ${deviceName} - ${sourceName}`, 'info');

	return {result: 'device-source-added-successfully', deviceId: deviceId};
}

function TallyArbiter_Edit_Device_Source(obj) {
	let deviceSourceObj = obj.device_source;
	let deviceId = null;
	let oldAddress = null;
	for (let i = 0; i < device_sources.length; i++) {
		if (device_sources[i].id === deviceSourceObj.id) {
			deviceId = device_sources[i].deviceId;
			device_sources[i].sourceId = deviceSourceObj.sourceId;
			oldAddress = device_sources[i].address;
			device_sources[i].address = deviceSourceObj.address;
		}
		if (device_sources[i].bus) {
			device_sources[i].bus = deviceSourceObj.bus;
		}
	}

	//also remove this device source address from device_states where device = this device, source = this source, address = this old address
	for (let i = 0; i < device_states.length; i++) {
		if (device_states[i].deviceId === deviceId) {
			for (let j = device_states[i].sources.length - 1; j >= 0; j--) {
				if (device_states[i].sources[j].sourceId === sourceId) {
					if (device_states[i].sources[j].address === oldAddress) {
						//remove this one, it's no longer valid for this device
						device_states[i].sources.splice(j, 1);
					}
				}
			}
		}
	}

	let deviceName = GetDeviceByDeviceId(deviceId).name;
	let sourceName = GetSourceBySourceId(deviceSourceObj.sourceId).name;

	UpdateCloud('device_sources');

	logger(`Device Source Edited: ${deviceName} - ${sourceName}`, 'info');

	return {result: 'device-source-edited-successfully', deviceId: deviceId};
}

function TallyArbiter_Delete_Device_Source(obj) {
	let deviceSourceId = obj.device_source.id;
	let deviceId = null;
	let sourceId = null;
	let oldAddress = null;

	//remove it from the device_sources array
	for (let i = 0; i < device_sources.length; i++) {
		if (device_sources[i].id === deviceSourceId) {
			deviceId = device_sources[i].deviceId;
			sourceId = device_sources[i].sourceId;
			oldAddress = device_sources[i].address;
			device_sources.splice(i, 1);
			break;
		}
	}

	//also remove this device source address from device_states where device = this device, source = this source, address = this old address
	for (let i = 0; i < device_states.length; i++) {
		if (device_states[i].deviceId === deviceId) {
			for (let j = device_states[i].sources.length -1; j >= 0; j--) {
				if (device_states[i].sources[j].sourceId === sourceId) {
					if (device_states[i].sources[j].address === oldAddress) {
						//remove this one, it's no longer valid for this device
						device_states[i].sources.splice(j, 1);
					}
				}
			}
		}
	}

	let deviceName = GetDeviceByDeviceId(deviceId).name;
	let sourceName = GetSourceBySourceId(sourceId).name;

	UpdateCloud('device_sources');

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
			break;
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
			break;
		}
	}

	logger(`TSL Client Deleted: ${tslClientObj.ip}:${tslClientObj.port} (${tslClientObj.transport})`, 'info');

	return {result: 'tsl-client-deleted-successfully'};
}

function TallyArbiter_Add_Cloud_Destination(obj) {
	let cloudObj = obj.cloudDestination;
	cloudObj.id = uuidv4();
	cloud_destinations.push(cloudObj);

	logger(`Cloud Destination Added: ${cloudObj.host}:${cloudObj.port}`, 'info');

	StartCloudDestination(cloudObj.id);

	return {result: 'cloud-destination-added-successfully'};
}

function TallyArbiter_Edit_Cloud_Destination(obj) {
	let cloudObj = obj.cloudDestination;

	for (let i = 0; i < cloud_destinations.length; i++) {
		if (cloud_destinations[i].id === cloudObj.id) {
			cloud_destinations[i].host = cloudObj.host;
			cloud_destinations[i].port = cloudObj.port;
			cloud_destinations[i].key = cloudObj.key;
			break;
		}
	}

	for (let i = 0; i < cloud_destinations_sockets.length; i++) {
		if (cloud_destinations_sockets[i].id === cloudObj.id) {
			cloud_destinations_sockets[i].host = cloudObj.host;
			cloud_destinations_sockets[i].port = cloudObj.port;
			cloud_destinations_sockets[i].key = cloudObj.key;
			break;
		}
	}

	//something was changed so we need to stop, give it time to disconnect, and then restart the connection
	StopCloudDestination(cloudObj.id);
	setTimeout(StartCloudDestination, 1000, cloudObj.id);

	logger(`Cloud Destination Edited: ${cloudObj.host}:${cloudObj.port}`, 'info');

	return {result: 'cloud-destination-edited-successfully'};
}

function TallyArbiter_Delete_Cloud_Destination(obj) {
	let cloudObj = GetCloudDestinationById(obj.cloudId);
	let cloudId = obj.cloudId;

	for (let i = 0; i < cloud_destinations.length; i++) {
		if (cloud_destinations[i].id === cloudId) {
			StopCloudDestination(cloudId);
			cloud_destinations.splice(i, 1);
			break;
		}
	}

	logger(`Cloud Destination Deleted: ${cloudObj.host}:${cloudObj.port}`, 'info');

	return {result: 'cloud-destination-deleted-successfully'};
}

function TallyArbiter_Add_Cloud_Key(obj) {
	cloud_keys.push(obj.key);

	logger(`Cloud Key Added: ${obj.key}`, 'info');

	return {result: 'cloud-key-added-successfully'};
}

function TallyArbiter_Delete_Cloud_Key(obj) {
	for (let i = 0; i < cloud_keys.length; i++) {
		if (cloud_keys[i] === obj.key) {
			cloud_keys.splice(i, 1);
			break;
		}
	}

	DeleteCloudClients(obj.key);

	logger(`Cloud Key Deleted: ${obj.key}`, 'info');

	return {result: 'cloud-key-deleted-successfully'};
}

function TallyArbiter_Remove_Cloud_Client(obj) {
	let ipAddress = null;
	let key = null;
	for (let i = 0; i < cloud_clients.length; i++) {
		if (cloud_clients[i].id === obj.id) {
			//disconnect the cloud client
			ipAddress = cloud_clients[i].ipAddress;
			key = cloud_clients[i].key;
			if (io.sockets.connected[cloud_clients[i].socketId]) {
				io.sockets.connected[cloud_clients[i].socketId].disconnect(true);
			}
			cloud_clients.splice(i, 1);
			break;
		}
	}

	logger(`Cloud Client Removed: ${obj.id}  ${ipAddress}  ${key}`, 'info');

	return {result: 'cloud-client-removed-successfully'};
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
	let device = undefined;

	if (deviceId !== 'unassigned') {
		device = devices.find( ({ id }) => id === deviceId);
	}

	if (!device) {
		device = {};
		device.id = 'unassigned';
		device.name = 'Unassigned';
	}

	return device;
}

function GetOutputTypeByOutputTypeId(outputTypeId) {
	//gets the Output Type object by id
	return output_types.find( ({ id }) => id === outputTypeId);
}

function GetDeviceSourcesBySourceId(sourceId) {
	return device_sources.filter(obj => obj.sourceId === sourceId);
}

function GetDeviceSourcesByDeviceId(deviceId) {
	return device_sources.filter(obj => obj.deviceId === deviceId);
}

function GetTSLClientById(tslClientId) {
	//gets the TSL Client by the Id
	return tsl_clients.find( ({ id }) => id === tslClientId);
}

function GetCloudDestinationById(cloudId) {
	//gets the Cloud Destination by the Id
	return cloud_destinations.find( ({ id }) => id === cloudId);
}

function GetCloudClientById(cloudClientId) {
	//gets the Cloud Client by the Id
	return cloud_clients.find( ({ id }) => id === cloudClientId);
}

function GetCloudClientBySocketId(socket) {
	//gets the Cloud Client by the Socket Id
	return cloud_clients.find( ({ socketId }) => socketId === socket);
}

function GetDeviceStatesByDeviceId(deviceId) {
	//gets the current tally data for the device and returns it

	return device_states.filter(obj => obj.deviceId === deviceId);
}

function AddListenerClient(socketId, deviceId, listenerType, ipAddress, datetimeConnected, canBeReassigned, canBeFlashed) {
	let clientObj = {};

	clientObj.id = uuidv4();
	clientObj.socketId = socketId;
	clientObj.deviceId = deviceId;
	clientObj.listenerType = listenerType;
	clientObj.ipAddress = ipAddress;
	clientObj.datetime_connected = datetimeConnected;
	clientObj.canBeReassigned = canBeReassigned;
	clientObj.canBeFlashed = canBeFlashed;
	clientObj.inactive = false;

	listener_clients.push(clientObj);

	let message = `Listener Client Connected: ${clientObj.ipAddress.replace('::ffff:', '')} (${clientObj.listenerType}) at ${new Date()}`;
	SendMessage('server', null, message);

	UpdateSockets('listener_clients');
	UpdateCloud('listener_clients');

	return clientObj.id;
}

function ReassignListenerClient(clientId, oldDeviceId, deviceId) {
	for (let i = 0; i < listener_clients.length; i++) {
		if (listener_clients[i].id === clientId) {
			if (listener_clients[i].canBeReassigned) {
				if (listener_clients[i].relayGroupId) {
					io.to(listener_clients[i].socketId).emit('reassign', listener_clients[i].relayGroupId, oldDeviceId, deviceId);
				}
				else if (listener_clients[i].gpoGroupId) {
					io.to(listener_clients[i].socketId).emit('reassign', listener_clients[i].gpoGroupId, oldDeviceId, deviceId);
				}
				else {
					io.to(listener_clients[i].socketId).emit('reassign', oldDeviceId, deviceId);
				}
			}
			break;
		}
	}
}

function DeactivateListenerClient(socketId) {
	for (let i = 0; i < listener_clients.length; i++) {
		if (listener_clients[i].socketId === socketId) {
			listener_clients[i].inactive = true;
			listener_clients[i].datetime_inactive = new Date().getTime();
			let message = `Listener Client Disconnected: ${listener_clients[i].ipAddress.replace('::ffff:', '')} (${listener_clients[i].listenerType}) at ${new Date()}`;
			SendMessage('server', null, message);
		}
	}

	UpdateSockets('listener_clients');
	UpdateCloud('listener_clients');
}

function DeleteInactiveListenerClients() {
	let changesMade = false;
	for (let i = listener_clients.length - 1; i >= 0; i--) {
		if (listener_clients[i].inactive === true) {
			let dtNow = new Date().getTime();
			if ((dtNow - listener_clients[i].datetime_inactive) > (1000 * 60 * 60)) { //1 hour
				logger(`Inactive Client removed: ${listener_clients[i].id}`, 'info');
				listener_clients.splice(i, 1);
				changesMade = true;
			}
		}
	}

	if (changesMade) {
		UpdateSockets('listener_clients');
		UpdateCloud('listener_clients');
	}

	setTimeout(DeleteInactiveListenerClients, 5 * 1000); // runs every 5 minutes
}

function FlashListenerClient(listenerClientId) {
	let listenerClientObj = listener_clients.find( ({ id }) => id === listenerClientId);

	if (listenerClientObj) {
		if (listenerClientObj.cloudConnection) {
			let cloudClientSocketId = GetCloudClientById(listenerClientObj.cloudClientId).socketId;
			if (io.sockets.connected[cloudClientSocketId]) {
				io.sockets.connected[cloudClientSocketId].emit('flash', listenerClientId);
			}
		}
		else {
			if (listenerClientObj.canBeFlashed) {
				if (listenerClientObj.relayGroupId) {
					io.to(listenerClientObj.socketId).emit('flash', listenerClientObj.relayGroupId);
				}
				else if (listenerClientObj.gpoGroupId) {
					io.to(listenerClientObj.socketId).emit('flash', listenerClientObj.gpoGroupId);
				}
				else {
					io.to(listenerClientObj.socketId).emit('flash');
				}
				return {result: 'flash-sent-successfully', listenerClientId: listenerClientId};
			}
			else {
				return {result: 'flash-not-sent', listenerClientId: listenerClientId, error: 'listener-client-not-supported'};
			}
		}
		
	}
	else {
		return {result: 'flash-not-sent', listenerClientId: listenerClientId, error: 'listener-client-not-found'};
	}
}

function MessageListenerClient(listenerClientId, type, socketid, message) {
	let listenerClientObj = listener_clients.find( ({ id }) => id === listenerClientId);

	if (listenerClientObj) {
		if (listenerClientObj.cloudConnection) {
			let cloudClientSocketId = GetCloudClientById(listenerClientObj.cloudClientId).socketId;
			if (io.sockets.connected[cloudClientSocketId]) {
				io.sockets.connected[cloudClientSocketId].emit('messaging_client', listenerClientId, type, socketid, message);
			}
		}
		else {
			if (listenerClientObj.canBeFlashed) {
				if ((!listenerClientObj.relayGroupId) && (!listenerClientId.gpoGroupId)) {
					io.to(listenerClientObj.socketId).emit('messaging_client', type, socketid, message);
					return {result: 'message-sent-successfully', listenerClientId: listenerClientId};
				}
				else {
					return {result: 'message-not-sent', listenerClientId: listenerClientId, error: 'listener-client-not-supported'};
				}
			}
			else {
				return {result: 'message-not-sent', listenerClientId: listenerClientId, error: 'listener-client-not-supported'};
			}
		}
		
	}
	else {
		return {result: 'message-not-sent', listenerClientId: listenerClientId, error: 'listener-client-not-found'};
	}
}

function AddCloudClient(socketId, key, ipAddress, datetimeConnected) {
	let cloudClientObj = {};

	cloudClientObj.id = uuidv4();
	cloudClientObj.socketId = socketId;
	cloudClientObj.key = key;
	cloudClientObj.ipAddress = ipAddress;
	cloudClientObj.datetimeConnected = datetimeConnected;
	cloudClientObj.inactive = false;

	cloud_clients.push(cloudClientObj);

	UpdateSockets('cloud_clients');

	return cloudClientObj.id;
}

function DeleteCloudClients(key) {
	for (let i = cloud_clients.length - 1; i >= 0; i--) {
		if (cloud_clients[i].key === key) {
			if (io.sockets.connected[cloud_clients[i].socketId]) {
				io.sockets.connected[cloud_clients[i].socketId].disconnect(true);
				cloud_clients.splice(i, 1);
			}
		}
	}

	UpdateSockets('cloud_clients');
}

function CheckCloudClients(socketId) { //check the list of cloud clients and if the socket is present, delete it, because they just disconnected
	let cloudClientId = null;

	if (socketId !== null) {
		for (let i = 0; i < cloud_clients.length; i++) {
			if (cloud_clients[i].socketId === socketId) {
				cloudClientId = cloud_clients[i].id;
				logger(`Cloud Client Disconnected: ${cloud_clients[i].ipAddress}`, 'info');
				cloud_clients.splice(i, 1);
				break;
			}
		}
	}

	DeleteCloudArrays(cloudClientId);
	UpdateSockets('cloud_clients');
}

function DeleteCloudArrays(cloudClientId) { //no other socket connections are using this key so let's remove all sources, devices, and device_sources assigned to this key
	for (let i = sources.length - 1; i >= 0; i--) {
		if (sources[i].cloudConnection) {
			if (sources[i].cloudClientId === cloudClientId) {
				sources.splice(i, 1);
			}
		}
	}

	for (let i = devices.length - 1; i >= 0; i--) {
		if (devices[i].cloudConnection) {
			if (devices[i].cloudClientId === cloudClientId) {
				devices.splice(i, 1);
			}
		}
	}

	for (let i = device_sources.length - 1; i >= 0; i--) {
		if (device_sources[i].cloudConnection) {
			if (device_sources[i].cloudClientId === cloudClientId) {
				device_sources.splice(i, 1);
			}
		}
	}

	for (let i = listener_clients.length - 1; i >= 0; i--) {
		if (listener_clients[i].cloudConnection) {
			if (listener_clients[i].cloudClientId === cloudClientId) {
				listener_clients.splice(i, 1);
			}
		}
	}

	CheckListenerClients();

	UpdateSockets('sources');
	UpdateSockets('devices');
	UpdateSockets('device_sources');
	UpdateSockets('listener_clients');
}

function CheckListenerClients() { //checks all listener clients and if a client is connected to a device that no longer exists (due to cloud connection), reassigns to the first device
	let newDeviceId = 'unassigned';
	if (devices.length > 0) {
		newDeviceId = devices[0].id;
	}

	for (let i = 0; i < listener_clients.length; i++) {
		if (!GetDeviceByDeviceId(listener_clients[i].deviceId)) {
			//this device has been removed, so reassign it to the first index
			ReassignListenerClient(listener_clients[i].id, listener_clients[i].deviceId, newDeviceId);
		}
	}
}

function AddPort(port, sourceId) { //Adds the port to the list of reserved or in-use ports
	let portObj = {};
	portObj.port = port;
	portObj.sourceId = sourceId;
	PortsInUse.push(portObj);
	UpdateSockets('PortsInUse');
}

function DeletePort(port) { //Deletes the port from the list of reserved or in-use ports
	for (let i = 0; i < PortsInUse.length; i++) {
		if (PortsInUse[i].port === port.toString()) {
			PortsInUse.splice(i, 1);
			break;
		}
	}
	UpdateSockets('PortsInUse');
}

function SendMessage(type, socketid, message) {
	io.to('messaging').emit('messaging', type, socketid, message);
}

startUp();
