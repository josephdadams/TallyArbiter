/* Tally Arbiter */

//Protocol, Network, Socket, Server libraries/variables
import net from 'net';
import packet from 'packet';
import TSLUMD from 'tsl-umd'; // TSL UDP package
import dgram from 'dgram';
import fs from 'fs';
import findPackageJson from "find-package-json";
import path from 'path';
import clc from 'cli-color';
import util from 'util';
import express, { Router } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import bodyParser from 'body-parser';
import axios from 'axios';
import osc from "osc";
import http from 'http';
import socketio from 'socket.io';
import ioClient from 'socket.io-client';
import xml2js from 'xml2js';
import { jspack } from "jspack";
import os from 'os'; // For getting available Network interfaces on host device
import findRemoveSync from 'find-remove';

//TypeScript models
import { CloudClient } from "./_models/CloudClient";
import { FlashListenerClientResponse } from "./_models/FlashListenerClientResponse";
import { MessageListenerClientResponse } from "./_models/MessageListenerClientResponse";
import { ErrorReport } from './_models/ErrorReport';
import { ErrorReportsListElement } from "./_models/ErrorReportsListElement";
import { NetworkInterface } from "./_models/NetworkInterface";
import { ConfigSecuritySection } from "./_models/ConfigSecuritySection";
import { ConfigTSLClient } from "./_models/ConfigTSLClient";
import { Config } from './_models/Config';
import { ManageResponse } from './_models/ManageResponse';
import { LogItem } from "./_models/LogItem";
import { Port } from "./_models/Port";
import { Source } from './_models/Source';
import { SourceType } from './_models/SourceType';
import { SourceTypeDataFields } from './_models/SourceTypeDataFields';
import { BusOption } from './_models/BusOption';
import { DeviceSource } from './_models/DeviceSource';
import { DeviceAction } from './_models/DeviceAction';
import { Device } from './_models/Device';
import { AddressTallyData, DeviceTallyData, SourceTallyData } from './_models/TallyData';
import { OutputType } from './_models/OutputType';
import { TSLClient } from './_models/TSLClient';
import { OutputTypeDataFields } from './_models/OutputTypeDataFields';
import { ListenerClientConnect } from './_models/ListenerClientConnect';
import { Manage } from './_models/Manage';
import { Addresses } from './_models/Addresses';
import { CloudListenerSocketData } from './_models/CloudListenerSocketData';
import { CloudDestination } from './_models/CloudDestination';
import { CloudDestinationSocket } from './_models/CloudDestinationSocket';
import { ListenerClient } from './_models/ListenerClient';

//TypeScript globals
import { TallyInputs } from './_globals/TallyInputs';
import { PortsInUse } from './_globals/PortsInUse';
import { Actions } from './_globals/Actions';

import { BehaviorSubject } from 'rxjs';
import { TallyInput } from './sources/_Source';

function loadClassesFromFolder(folder: string): void {
	for (const file of fs.readdirSync(path.join(__dirname, folder)).filter((f) => !f.startsWith("_"))) {
		require(`./${folder}/${file.replace(".ts", "")}`);
	}
}

const version = findPackageJson(__dirname).next()?.value?.version || "unknown";

//Rate limiter configurations
const maxWrongAttemptsByIPperDay = 100;
const maxConsecutiveFailsByUsernameAndIP = 10;
const limiterSlowBruteByIP = new RateLimiterMemory({
  keyPrefix: 'login_fail_ip_per_day',
  points: maxWrongAttemptsByIPperDay,
  duration: 60 * 60 * 24, // Store number for 1 day since first fail
  blockDuration: 60 * 60 * 24, // Block for 1 day
});
const limiterConsecutiveFailsByUsernameAndIP = new RateLimiterMemory({
  keyPrefix: 'login_fail_consecutive_username_and_ip',
  points: maxConsecutiveFailsByUsernameAndIP,
  duration: 60 * 60 * 24, // Store number for 1 day since first fail
  blockDuration: 60 * 60 * 2, // Block for 2 hours
});

//Tally Arbiter variables
var uiDistPath = path.join(__dirname, 'ui-dist');
if (!fs.existsSync(uiDistPath)) {
    uiDistPath = path.join(__dirname, '..', 'ui-dist');
}

const listenPort: number = parseInt(process.env.PORT) || 4455;
const app = express();
const appProducer: Router = require('express').Router();
const appSettings: Router = require('express').Router();
const httpServer = new http.Server(app);

const io = new socketio.Server(httpServer, { allowEIO3: true });
const socketupdates_Settings: string[]  = ['sources', 'devices', 'device_sources', 'currentTallyData', 'listener_clients', 'tsl_clients', 'cloud_destinations', 'cloud_keys', 'cloud_clients', 'PortsInUse', 'vmix_clients', "addresses"];
const socketupdates_Producer: string[]  = ['sources', 'devices', 'device_sources', 'currentTallyData', 'listener_clients'];
const socketupdates_Companion: string[] = ['sources', 'devices', 'device_sources', 'currentTallyData', 'listener_clients', 'tsl_clients', 'cloud_destinations'];

var username_producer: string = 'producer';
var password_producer: string = '12345';
var username_settings: string = 'admin';
var password_settings: string = '12345';

var logFilePath 	  = getLogFilePath();
var logFile 		  = fs.openSync(logFilePath, 'w'); // Setup Log file
var Logs: LogItem[]   = []; //array of actions, information, and errors
var tallyDataFilePath = getTallyDataPath();
var tallyDataFile 	  = fs.openSync(tallyDataFilePath, 'w'); // Setup TallyData File
const config_file 	  = getConfigFilePath(); //local storage JSON file

const vmixEmulatorPort: string = '8099'; // Default 8099 
var oscUDP			= null;
var vmix_emulator	= null; //TCP server for VMix Emulator
var vmix_clients 	= []; //Clients currently connected to the VMix Emulator
var listener_clients = []; //array of connected listener clients (web, python, relay, etc.)
var vmix_client_data = []; //array of connected Vmix clients
var tallydata_RossCarbonite = []; //array of Ross Carbonite sources and current tally data by bus
var tallydata_VMix 	= []; //array of VMix sources and current tally data
var tallydata_TC 	= []; //array of Tricaster sources and current tally data
var tallydata_AWLivecore 	= []; //array of Analog Way sources and current tally data
var tallydata_Panasonic 	= []; //array of Panasonic AV-HS410 sources and current tally data

var tsl_clients: TSLClient[]							 = []; //array of TSL 3.1 clients that Tally Arbiter will send tally data to
var tsl_clients_1secupdate 								 = false;
var tsl_clients_interval: NodeJS.Timer | null			 = null;
var cloud_destinations: CloudDestination[]				 = []; //array of Tally Arbiter Cloud Destinations (host, port, key)
var cloud_destinations_sockets: CloudDestinationSocket[] = []; //array of actual socket connections
var cloud_keys: string[] 								 = []; //array of Tally Arbiter Cloud Sources (key only)
var cloud_clients: CloudClient[]						 = []; //array of Tally Arbiter Cloud Clients that have connected with a key

var TestMode = false; //if the system is in test mode or not
const SourceClients: Record<string, TallyInput> = {};

PortsInUse.push({ 
    port: vmixEmulatorPort, //VMix
    sourceId: 'reserved',
});

PortsInUse.push({ 
    port: '60020', //Panasonic AV-HS410
    sourceId: 'reserved',
});

PortsInUse.push({ 
    port: listenPort.toString(), //Tally Arbiter
    sourceId: 'reserved',
});

PortsInUse.push({ 
    port: "80", //Default HTTP Port
    sourceId: 'reserved',
});

PortsInUse.push({ 
    port: "443",
    sourceId: 'reserved',
});

const addresses = new BehaviorSubject<Addresses>({});
addresses.subscribe(() => {
	UpdateSockets("addresses");
});

var source_types_panasonic = [ // AV-HS410 INPUTS
	{ id: '00', label: 'XPT 1' },
	{ id: '01', label: 'XPT 2' },
	{ id: '02', label: 'XPT 3' },
	{ id: '03', label: 'XPT 4' },
	{ id: '04', label: 'XPT 5' },
	{ id: '05', label: 'XPT 6' },
	{ id: '06', label: 'XPT 7' },
	{ id: '07', label: 'XPT 8' },
	{ id: '08', label: 'XPT 9' },
	{ id: '09', label: 'XPT 10' },
	{ id: '10', label: 'XPT 11' },
	{ id: '11', label: 'XPT 12' },
	{ id: '12', label: 'XPT 13' },
	{ id: '13', label: 'XPT 14' },
	{ id: '14', label: 'XPT 15' },
	{ id: '15', label: 'XPT 16' },
	{ id: '16', label: 'XPT 17' },
	{ id: '17', label: 'XPT 18' },
	{ id: '18', label: 'XPT 19' },
	{ id: '19', label: 'XPT 20' },
	{ id: '20', label: 'XPT 21' },
	{ id: '21', label: 'XPT 22' },
	{ id: '22', label: 'XPT 23' },
	{ id: '23', label: 'XPT 24' },
];

var bus_options: BusOption[] = [ // the busses available to monitor in Tally Arbiter
	{ id: 'e393251c', label: 'Preview', type: 'preview', color: '#3fe481', priority: 50},
	{ id: '334e4eda', label: 'Program', type: 'program', color: '#e43f5a', priority: 200},
	{ id: '12c8d699', label: 'Aux 1', type: 'aux', color: '#0000FF', priority: 100},
	{ id: '12c8d689', label: 'Aux 2', type: 'aux', color: '#0000FF', priority: 100}
]

var sources: Source[]						= []; // the configured tally sources
var devices: Device[] 						= []; // the configured tally devices
var device_sources: DeviceSource[]			= []; // the configured tally device-source mappings
var device_actions: DeviceAction[]			= []; // the configured device output actions
var currentDeviceTallyData: DeviceTallyData = {}; // tally data (=bus array) per device id (linked busses taken into account)
var currentSourceTallyData: SourceTallyData = {}; // tally data (=bus array) per device source id
var source_connections						= []; // array of source connections/servers as they are established

function uuidv4(): string //unique UUID generator for IDs
{
	return 'xxxxxxxx'.replace(/[xy]/g, function(c) {
		let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

function startUp() {
	loadClassesFromFolder("actions");
	loadClassesFromFolder("sources");
	loadConfig();
	initialSetup();
	DeleteInactiveListenerClients();
	DeleteInactiveVmixListenerClients();

	process.on('uncaughtException', function (err: Error) {
		if (!process.versions.hasOwnProperty('electron')) {
			generateErrorReport(err);
		}
	});
}

//based on https://stackoverflow.com/a/37096512
//used in login function for displaying rate limits
function secondsToHms(d: number | string): string {
    d = Number(d);
    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);

    var hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
    var mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
    var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
	let hmsString = hDisplay + mDisplay + sDisplay;
	if(hmsString.endsWith(", ")) hmsString = hmsString.slice(0, -2);
    return hmsString;
}

//sets up the REST API and GUI pages and starts the Express server that will listen for incoming requests
function initialSetup() {
	logger('Setting up the REST API.', 'info-quiet');

	app.disable('x-powered-by');
	app.use(bodyParser.json({ type: 'application/json' }));

	//about the author, this program, etc.
	app.get('/', function (req, res) {
		res.sendFile('index.html', { root: uiDistPath });
	});

	//gets the version of the software
	app.get('/version', function (req, res) {
		res.send(version);
	});

	//roland smart tally emulation
	app.get('/tally/:tallynumber/status', function(req, res) {
		//the tally number is the device index number shown in the web GUI
		let tallynumber = req.params.tallynumber;

		let status = 'unselected';

		if (tallynumber) {
			if (parseInt(tallynumber) > 0) {
				status = GetSmartTallyStatus(tallynumber);
			}
		}

		res.send(status);
	});

	appProducer.use((req, res, next) => {

		// -----------------------------------------------------------------------
		// authentication middleware

		// parse login and password from headers
		const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
		const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

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

	appSettings.use((req, res, next) => {

		// -----------------------------------------------------------------------
		// authentication middleware

		// parse login and password from headers
		const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
		const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

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

	appSettings.get('/source_types', function (req, res) {
		//gets all Tally Source Types
		res.send(getSourceTypes());
	});

	appSettings.get('/source_types_datafields', function (req, res) {
		//gets all Tally Source Types Data Fields
		res.send(getSourceTypeDataFields());
	});

	appSettings.get('/source_types_busoptions', function (req, res) {
		//gets all Tally Source Types Bus Options
		res.send(Object.entries(addresses.value).map(([deviceSourceId, addresses]) =>({
			sourceTypeId: device_sources.find((d) => d.id == deviceSourceId).sourceId,
			busses: addresses.map((a) => ({bus: a.address, name: a.label})),
		})));
	});

	appSettings.get('/output_types', function (req, res) {
		//gets all Tally Output Types
		res.send(getOutputTypes());
	});

	appSettings.get('/output_types_datafields', function (req, res) {
		//gets all Tally Output Types Data Fields
		res.send(getOutputTypeDataFields());
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

	appSettings.get('/currentTallyData', function (req, res) {
		//gets all Tally Device States
		// ToDo
		res.send(null);
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

	//serve up any files in the ui-dist folder
	app.use(express.static(uiDistPath));

	app.use(function (req, res) {
		res.status(404).send({error: true, url: req.originalUrl + ' not found.'});
	});

	logger('REST API Setup Complete.', 'info-quiet');

	logger('Starting socket.IO Setup.', 'info-quiet');

	io.sockets.on('connection', function(socket) {
		const ipAddr = socket.handshake.address;

		socket.on('login', function (type: "settings" | "producer", username: string, password: string) {
			if((type === "producer" && username == username_producer && password == password_producer)
			|| (type === "settings" && username == username_settings && password == password_settings)) {
				//login successfull
				socket.emit('login_result', true); //old response, for compatibility with old UI clients
				socket.emit('login_response', { loginOk: true, message: "" });
			} else {
				//wrong credentials
				Promise.all([
					limiterConsecutiveFailsByUsernameAndIP.consume(ipAddr),
					limiterSlowBruteByIP.consume(`${username}_${ipAddr}`)
				]).then((values) => {
					//rate limits not exceeded
					let points = values[0].remainingPoints;
					let message = "Wrong username or password!";
					if(points < 4) {
						message += " Remaining attemps:"+points;
					}
					socket.emit('login_result', false); //old response, for compatibility with old UI clients
					socket.emit('login_response', { loginOk: false, message: message });
				}).catch((error) => {
					//rate limits exceeded
                    socket.emit('login_result', false); //old response, for compatibility with old UI clients
                    let retrySecs = 1;
					try{
						retrySecs = Math.round(error.msBeforeNext / 1000) || 1;
					} catch(e) {
						retrySecs = Math.round(error[0].msBeforeNext / 1000) || 1;
					}
					socket.emit('login_response', { loginOk: false, message: "Too many attemps! Please try "+secondsToHms(retrySecs)+" later." });
				});
			}
		});

		socket.on('version', () =>  {
			socket.emit('version', version);
		});

		socket.on('interfaces', () =>  {
			socket.emit('interfaces', getNetworkInterfaces());
		});

		socket.on('sources', () =>  { // sends the configured Sources to the socket
			socket.emit('sources', getSources());
		});

		socket.on('devices', () =>  { // sends the configured Devices to the socket
			socket.emit('devices', devices);
		});

		socket.on('device_sources', () =>  { // sends the configured Device Sources to the socket
			socket.emit('device_sources', device_sources);
		});

		socket.on('device_actions', () =>  { // sends the configured Device Actions to the socket
			socket.emit('device_actions', device_actions);
		});

		socket.on('bus_options', () =>  { // sends the Bus Options (preview, program) to the socket
			socket.emit('bus_options', bus_options);
		});

		socket.on('listenerclient_connect', function(obj: ListenerClientConnect) {
			/*
			This is the new listener client API, all clients should connect and send a JSON object with these properties:
			deviceId
			listenerType (string to be displayed)
			canBeReassigned (bool)
			canBeFlashed (bool)
			supportsChat (bool)
			*/

			let deviceId = obj.deviceId;
			let device = GetDeviceByDeviceId(deviceId);
			let oldDeviceId = null;

			if ((deviceId === 'null') || (device.id === 'unassigned')) {
				if (devices.length > 0) {
					oldDeviceId = deviceId;
					deviceId = devices[0].id;
					socket.emit('error', 'Invalid Device Id specified. Reassigning to the first Device on the server.');
				}
				else {
					//send error state
					socket.emit('error', 'No Devices are configured in Tally Arbiter.');
				}
			}

			let listenerType = obj.listenerType ? obj.listenerType : 'client';
			let canBeReassigned = obj.reassign ? obj.reassign : false;
			let canBeFlashed = obj.flash ? obj.flash : false;
			let supportsChat = obj.chat ? obj.chat : false;

			socket.join('device-' + deviceId);
			let deviceName = GetDeviceByDeviceId(deviceId).name;
			logger(`Listener Client Connected. Type: ${listenerType} Device: ${deviceName}`, 'info');

			let ipAddress = socket.handshake.address;
			let datetimeConnected = new Date().getTime();
			let clientId = AddListenerClient(socket.id, deviceId, listenerType, ipAddress, datetimeConnected, canBeReassigned, canBeFlashed, supportsChat);
			
			if (supportsChat) {
				socket.join('messaging');
			}
			else {
				socket.leave('messaging');
			}

			socket.emit('bus_options', bus_options);
			socket.emit('devices', devices);
			socket.emit('currentTallyData', currentDeviceTallyData);

			if (oldDeviceId !== null) {
				//sends a reassign command to officially reassign the listener client to the new device ID since the first one was invalid
				ReassignListenerClient(clientId, oldDeviceId, deviceId);
			}
		});

		socket.on('device_listen', function(deviceId: string, listenerType: string) { // emitted by a socket (tally page) that has selected a Device to listen for state information
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

			let ipAddress = socket.handshake.address;
			let datetimeConnected = new Date().getTime();

			let clientId = AddListenerClient(socket.id, deviceId, listenerType, ipAddress, datetimeConnected, true, true);
			socket.emit('currentTallyData', currentDeviceTallyData);
		});

		socket.on('device_listen_blink', function(obj: { deviceId: string }) { // emitted by the Python blink(1) client that has selected a Device to listen for state information
			let deviceId = obj.deviceId;
			let device = GetDeviceByDeviceId(deviceId);
			let oldDeviceId = null;

			if ((deviceId === 'null') || (device.id === 'unassigned')) {
				if (devices.length > 0) {
					deviceId = devices[0].id;
				}
				else {
					deviceId = 'unassigned';
				}

				oldDeviceId = deviceId;
			}

			let listenerType = 'blink(1)';

			socket.join('device-' + deviceId);
			let deviceName = GetDeviceByDeviceId(deviceId).name;
			logger(`Listener Client Connected. Type: ${listenerType} Device: ${deviceName}`, 'info');

			let ipAddress = socket.handshake.address;
			let datetimeConnected = new Date().getTime();

			let clientId = AddListenerClient(socket.id, deviceId, listenerType, ipAddress, datetimeConnected, true, true);
			socket.emit('devices', devices);
			socket.emit('currentTallyData', currentDeviceTallyData);
			if (oldDeviceId !== null) {
				ReassignListenerClient(clientId, oldDeviceId, deviceId);
			}
		});

		socket.on('device_listen_relay', function(relayGroupId: string, deviceId: string) { // emitted by the Relay Controller accessory program that has selected a Device to listen for state information
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

			let ipAddress = socket.handshake.address;
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

		socket.on('device_listen_gpo', function(obj: { gpoGroupId: string, deviceId: string }) { // emitted by the Python GPO Controller client that has selected a Device to listen for state information
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

			let ipAddress = socket.handshake.address;
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

		socket.on('device_listen_m5', function(obj: { deviceId: string, listenerType?: string }) { // emitted by the M5 Arduino clients (Atom, Stick C, Stick C Plus, etc.) that has selected a Device to listen for state information
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
				socket.emit('currentTallyData', currentDeviceTallyData);
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

			let ipAddress = socket.handshake.address;
			let datetimeConnected = new Date().getTime();

			let clientId = AddListenerClient(socket.id, deviceId, listenerType, ipAddress, datetimeConnected, true, true);
		});

		socket.on('currentTallyData', function(deviceId: string) {
			socket.emit('currentTallyData', currentDeviceTallyData);
		});

		socket.on('settings', function () {
			socket.join('settings');
			socket.join('messaging');
			socket.emit('initialdata', getSourceTypes(), getSourceTypeDataFields(), addresses.value, getOutputTypes(), getOutputTypeDataFields(), bus_options, getSources(), devices, device_sources, device_actions, currentDeviceTallyData, tsl_clients, cloud_destinations, cloud_keys, cloud_clients);
			socket.emit('listener_clients', listener_clients);
			socket.emit('logs', Logs);
			socket.emit('PortsInUse', PortsInUse);
			socket.emit('tslclients_1secupdate', tsl_clients_1secupdate);
		});

		socket.on('producer', function () {
			socket.join('producer');
			socket.join('messaging');
			socket.emit('sources', getSources());
			socket.emit('devices', devices);
			socket.emit('bus_options', bus_options);
			socket.emit('listener_clients', listener_clients);
			socket.emit('currentTallyData', currentDeviceTallyData);
		});

		socket.on('companion', function () {
			socket.join('companion');
			socket.emit('sources', getSources());
			socket.emit('devices', devices);
			socket.emit('bus_options', bus_options);
			socket.emit('device_sources', device_sources);
			socket.emit('currentTallyData', currentDeviceTallyData);
			socket.emit('listener_clients', listener_clients);
			socket.emit('tsl_clients', tsl_clients);
			socket.emit('cloud_destinations', cloud_destinations);
		});

		socket.on('flash', function(clientId) {
			FlashListenerClient(clientId);
		});

		socket.on('messaging_client', function(clientId: {
			relayGroupId?: string;
			gpoGroupId?: string;
		}, type: string, socketid: string, message: string) {
			MessageListenerClient(clientId, type, socketid, message);
		});

		socket.on('reassign', function(clientId: string, oldDeviceId: string, deviceId: string) {
			ReassignListenerClient(clientId, oldDeviceId, deviceId);
		});

		socket.on('listener_reassign', function(oldDeviceId: string, deviceId: string) {
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
			socket.emit('currentTallyData', currentDeviceTallyData);
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
			socket.emit('currentTallyData', currentDeviceTallyData);
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
			let ipAddress = socket.handshake.address;

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

					for (let j = 0; j < sources.length; j++) {
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
						for (let j = 0; j < data.length; j++) {
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

					for (let j = 0; j < devices.length; j++) {
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
					}
				}

				for (let i = 0; i < devices.length; i++) {
					let found = false;

					if (devices[i].cloudClientId === cloudClientId) {
						for (let j = 0; j < data.length; j++) {
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

					for (let j = 0; j < device_sources.length; j++) {
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
						for (let j = 0; j < data.length; j++) {
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

		socket.on('cloud_listeners', function(key: string, data: CloudListenerSocketData[]) {
			let cloudClientId = GetCloudClientBySocketId(socket.id).id;

			//loop through the received array and if an item in the array isn't already in the listener_clients array, add it, and attach the cloud ID as a property
			if (cloud_keys.includes(key)) {
				for (let i = 0; i < data.length; i++) {
					let found = false;

					for (let j = 0; j < listener_clients.length; j++) {
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
						for (let j = 0; j < data.length; j++) {
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

		socket.on('cloud_data', function(key: string, sourceId: string, tallyObj: SourceTallyData) {
			if (cloud_keys.includes(key)) {
				processSourceTallyData(sourceId, tallyObj);
			}
			else {
				socket.emit('invalidkey');
				socket.disconnect();
			}
		});

		socket.on('manage', function(arbiterObj: Manage) {
			const response = TallyArbiter_Manage(arbiterObj);
			io.to('settings').emit('manage_response', response);
		});

		socket.on('reconnect_source', function(sourceId: string) {
			SourceClients[sourceId]?.reconnect();
		});

		socket.on('listener_clients', () =>  {
			socket.emit('listener_clients', listener_clients);
		});
		
		socket.on('tsl_clients', () =>  {
			socket.emit('tsl_clients', tsl_clients);
		});
		
		socket.on('cloud_destinations', () =>  {
			socket.emit('cloud_destinations', cloud_destinations);
		});

		socket.on('cloud_keys', () =>  {
			socket.emit('cloud_keys', cloud_keys);
		});

		socket.on('cloud_clients', () =>  {
			socket.emit('cloud_clients', cloud_clients);
		});

		socket.on('testmode', function(value: boolean) {
			EnableTestMode(value);
		});

		socket.on('tslclients_1secupdate', function(value: boolean) {
			tsl_clients_1secupdate = value;
			SaveConfig();
			TSLClients_1SecUpdate(value);
		})

		socket.on('messaging', function(type: string, message: string) {
			SendMessage(type, socket.id, message);
		});

		socket.on('get_error_reports', () =>  {
			socket.emit('error_reports', getErrorReportsList());
		});

		socket.on('get_unreaded_error_reports', () =>  {
			socket.emit('unreaded_error_reports', getUnreadedErrorReportsList());
		});

		socket.on('get_error_report', function(errorReportId: string) {
			markErrorReportAsReaded(errorReportId);
			socket.emit('error_report', getErrorReport(errorReportId));
		});

		socket.on('disconnect', () =>  { // emitted when any socket.io client disconnects from the server
			DeactivateListenerClient(socket.id);
			CheckCloudClients(socket.id);
		});
	});

	logger('Socket.IO Setup Complete.', 'info-quiet');

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

function getSources(): Source[] {
	return sources.map((s) => {
		s.connected = SourceClients[s.id]?.connected?.value || false;
		return s;
	});
}

function getSourceTypeDataFields(): SourceTypeDataFields[] {
	return Object.entries(TallyInputs).map(([id, data]) => ({
		sourceTypeId: id,
		fields: data.configFields,
	} as SourceTypeDataFields));
}

function getOutputTypeDataFields(): OutputTypeDataFields[] {
	return Object.entries(Actions).map(([id, data]) => ({
		outputTypeId: id,
		fields: data.configFields,
	} as OutputTypeDataFields));
}

function getSourceTypes(): SourceType[] {
	return Object.entries(TallyInputs).map(([id, data]) => ({
		enabled: true,
		help: data.help,
		id,
		label: data.label,
		type: null,
		busses: data.busses || [],
	} as SourceType));
}

function getOutputTypes(): OutputType[] {
	return Object.entries(Actions).map(([id, data]) => ({
		enabled: true,
		id: id,
		label: data.label,
		type: null,
	} as OutputType));
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
            sources.push({
                id: 'TEST',
                name: 'TEST MODE',
                sourceTypeId: 'TESTMODE',
                enabled: true,
                reconnect: false,
                connected: true,
				data: {},
            });
			UpdateSockets('sources');
			UpdateCloud('sources');
			TestTallies();
			SendMessage('server', null, 'Test Mode Enabled.');
		}
	}
	else {
		//turn off test mode
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
	// ToDo
}


function UpdateDeviceState(deviceId: string) {
	const device = GetDeviceByDeviceId(deviceId);
	if (!device) return;

	const previousBusses = [...currentDeviceTallyData[device.id] || []];
	currentDeviceTallyData[device.id] = [];

	const deviceSources = device_sources.filter((d) => d.deviceId == deviceId);
	for (const bus of bus_options) {
		if (device.linkedBusses.includes(bus.id)) {
			// bus is linked, which means all sources must be in this bus
			if (deviceSources.findIndex((s) => !currentSourceTallyData?.[s.id]?.includes(bus.type)) === -1) {
				currentDeviceTallyData[device.id].push(bus.id);
				if (!previousBusses.includes(bus.id)) {
					RunAction(deviceId, bus.id, true);
				}
			} else {
				if (previousBusses.includes(bus.id)) {
					RunAction(deviceId, bus.id, false);
				}
			}
		} else {
			// bus is unlinked
			if (deviceSources.findIndex((s) => currentSourceTallyData?.[s.id]?.includes(bus.type)) !== -1) {
				currentDeviceTallyData[device.id].push(bus.id);
				if (!previousBusses.includes(bus.id)) {
					RunAction(deviceId, bus.id, true);
				}
			} else {
				if (previousBusses.includes(bus.id)) {
					RunAction(deviceId, bus.id, false);
				}
			}
		}
	}
	UpdateSockets("currentTallyData");
	UpdateListenerClients(deviceId);
}

function startVMixEmulator() {
	vmix_emulator = net.createServer();

	vmix_emulator.on('connection', handleConnection);

	vmix_emulator.listen(parseInt(vmixEmulatorPort), () =>  {
		logger(`Finished VMix Emulation Setup. Listening for VMix Tally Connections on TCP Port ` + vmixEmulatorPort + `.`, 'info-quiet');
	});

	function handleConnection(conn) {
		let host = conn.remoteAddress + ':' + conn.remotePort;
		logger(`New VMix Emulator Connection from ${host}`, 'info');
		conn.write(`VERSION OK ${version}\r\n`);
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
			if (err.message === 'This socket has been ended by the other party') {
				logger(`VMix Emulator Connection ${host} taking longer to respond than normal`, 'debug');
				//removeVmixListener(host);
			} else {
				logger(`VMix Emulator Connection ${host} error: ${err.message}`, 'error');
			}
		}
	}
}

function addVmixListener(conn, host) {
	let socketId = 'vmix-' + uuidv4();
	//listenerClientId = AddListenerClient(socketId, null, 'vmix', host, new Date().getTime(), false, false);
	conn.listenerClientId = uuidv4();
	conn.host = host;
	conn.socketId = socketId;
	vmix_clients.push(conn);

	//Push to global var
    vmix_client_data.push({
        host,
        socketID: socketId,
        inactive: false,
    });
	console.log(vmix_client_data);
	console.log(vmix_client_data.length);
	UpdateSockets('vmix_clients');
	logger(`VMix Emulator Connection ${host} subscribed to tally`, 'info');
}

function removeVmixListener(host) {
	let socketId = null;

	for (let i = 0; i < vmix_client_data.length; i++) {
		if (vmix_client_data[i].host === host) {
			socketId = vmix_client_data[i].socketId;
			vmix_client_data.splice(i, 1);
		}
	}

	if (socketId !== null) {
		DeactivateVmixListenerClient(socketId);
	}

	logger(`VMix Emulator Connection ${host} unsubscribed to tally`, 'info');
}

export function logger(log: string, type: string) { //logs the item to the console, to the log array, and sends the log item to the settings page

	let dtNow = new Date().toISOString();

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

    const logObj: LogItem = {
        datetime: dtNow.toString(),
        log: log,
        type: type as LogItem["type"],
    };
	Logs.push(logObj);

	writeLogFile(log);

	io.to('settings').emit('log_item', logObj);
}

function writeLogFile(log) {
	try {
		var humanFriendlyDtNow = new Date().toLocaleString();

		var logString = '[' + humanFriendlyDtNow + '] ' + log;

		fs.appendFileSync(logFile, logString + '\n');
	}
	catch (error) {
		logger(`Error saving logs to file: ${error}`, 'error');
	}
}

function writeTallyDataFile(log) {
	try {
		const logLine = JSON.stringify(log) + ','
		fs.appendFileSync(tallyDataFile, logLine + '\n');
	}
	catch (error) {
		logger(`Error saving logs to file: ${error}`, 'error');
	}
}

function loadConfig() { // loads the JSON data from the config file to memory
	logger('Loading the stored Tally Arbiter configuration file.', 'info-quiet');

	try {
		let rawdata = fs.readFileSync(config_file).toString();
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

		if (configJson.bus_options) {
			bus_options = configJson.bus_options;
			logger('Tally Arbiter Bus Options loaded.', 'info');
			logger(`${bus_options.length} Busses configured.`, 'info');
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
			logger(`Initiating Setup for Source: ${sources[i].name}`, 'info-quiet');

			initializeSource(sources[i]);
		}
	}

	logger('Source Setup Complete.', 'info-quiet');
}

function initializeSource(source: Source): void {
	if (!TallyInputs[source.sourceTypeId]?.cls) {
		console.log(TallyInputs);
		console.log(source)
		throw Error(`No class found for Source ${source.name} (${source.sourceTypeId})`);
	}
	const sourceClient = new TallyInputs[source.sourceTypeId].cls(source) as TallyInput;
	sourceClient.connected.subscribe(() => {
		UpdateSockets('sources');
		UpdateCloud('sources');
	});
	sourceClient.tally.subscribe((tallyDataWithAddresses: AddressTallyData) => {
		const tallyData: SourceTallyData = {};
		for (const [sourceAddress, busses] of Object.entries(tallyDataWithAddresses)) {
			tallyData[device_sources.find((s) => s.sourceId == source.id && s.address == sourceAddress).id] = busses;
		}
		processSourceTallyData(source.id, tallyData);
	});
	sourceClient.addresses.subscribe((sourceAddresses) => {
		addresses.next({
			...addresses.value,
			[source.id]: sourceAddresses,
		});
	});
	SourceClients[source.id] = sourceClient;
}

function SaveConfig() {
	try {
		let securityObj: ConfigSecuritySection = {} as ConfigSecuritySection;
		securityObj.username_settings = username_settings;
		securityObj.password_settings = password_settings;
		securityObj.username_producer = username_producer;
		securityObj.password_producer = password_producer;

		let tsl_clients_clean: ConfigTSLClient[] = [];

		for (let i = 0; i < tsl_clients.length; i++) {
            let tslClientObj: ConfigTSLClient = {} as ConfigTSLClient;
			tslClientObj.id = tsl_clients[i].id;
			tslClientObj.ip = tsl_clients[i].ip;
			tslClientObj.port = tsl_clients[i].port;
			tslClientObj.transport = tsl_clients[i].transport;
			tsl_clients_clean.push(tslClientObj);
		}

		let configJson: Config = {
			security: securityObj,
			sources: sources,
			devices: devices,
			device_sources: device_sources,
			device_actions: device_actions,
			tsl_clients: tsl_clients_clean,
			tsl_clients_1secupdate: tsl_clients_1secupdate,
			cloud_destinations: cloud_destinations,
			cloud_keys: cloud_keys,
			bus_options: bus_options
		};

		fs.writeFileSync(config_file, JSON.stringify(configJson, null, 1), 'utf8');

		logger('Config file saved to disk.', 'info-quiet');
	}
	catch (error) {
		logger(`Error saving configuration to file: ${error}`, 'error');
	}
}

function getConfig(): Config {
	return JSON.parse(fs.readFileSync(getConfigFilePath()).toString());
}

function getConfigRedacted(): Config {
	let config: Config = JSON.parse(fs.readFileSync(getConfigFilePath()).toString());
	config["security"] = {
		username_settings: "admin",
		password_settings: "12345",
		username_producer: "producer",
		password_producer: "12345"
	};
	config["cloud_destinations"] = [];
	config["cloud_keys"] = [];
	return config;
}


function SetUpTSLServer_UDP(sourceId)
{
	let source = sources.find( ({ id }) => id === sourceId);
	let port = source.data.port;

	try
	{
        let sourceConnectionObj = {
            sourceId,
            server: null,
        };
		source_connections.push(sourceConnectionObj);

		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				AddPort(port, sourceId);
				logger(`Source: ${source.name}  Creating TSL 3.1 UDP Connection.`, 'info-quiet');
				source_connections[i].server = new TSLUMD(port);

				source_connections[i].server.on('message', function (tally) {
					processSourceTallyData(sourceId, tally);
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

        let sourceConnectionObj = {
            sourceId,
            server: null,
        };
		source_connections.push(sourceConnectionObj);

		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				AddPort(port, sourceId);
				logger(`Source: ${source.name}  Creating TSL 3.1 TCP Connection.`, 'info-quiet');
				source_connections[i].server = net.createServer(function (socket) {
					socket.on('data', function (data) {
						parser.extract('tsl', function (result) {
							result.label = new Buffer(result.label).toString();
							processSourceTallyData(sourceId, result);
						});
						parser.parse(data);
					});

					socket.on('close', function () {
						logger(`Source: ${source.name}  TSL 3.1 Server connection closed.`, 'info');
						StopTSLServer_TCP(sourceId);
					});
				}).listen(port, () =>  {
					logger(`Source: ${source.name}  TSL 3.1 Server started. Listening for data on TCP Port: ${port}`, 'info');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = true;
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

	try
	{
		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				source_connections[i].server.close(() =>  {});
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
        let sourceConnectionObj = {
            sourceId,
            server: null,
        };
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
        let sourceConnectionObj = {
            sourceId,
            server: null,
        };
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
					});
				}).listen(port, () =>  {
					logger(`Source: ${source.name}  TSL 5.0 Server started. Listening for data on TCP Port: ${port}`, 'info');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = true;
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

	try
	{
		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				source_connections[i].server.close(() =>  {});
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

		let tallyobj: any = {};

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

		let inPreview = 0;
		let inProgram = 0;
        
		switch(tallyobj.control.text_tally) {
			case 0:
				inPreview = 0;
				inProgram = 0;
				break;
			case 1:
				inPreview = 0;
				inProgram = 1;
				break;
			case 2:
				inPreview = 1;
				inProgram = 0;
				break;
			case 3:
				inPreview = 1;
				inProgram = 1;
				break;
		}

		let newTallyObj: any = {};
		newTallyObj.tally1 = inPreview;
		newTallyObj.preview = inPreview;
		newTallyObj.tally2 = inProgram;
		newTallyObj.program = inProgram;
		newTallyObj.address = tallyobj.INDEX[0];
		newTallyObj.label = tallyobj.TEXT.join('').trim();

		processSourceTallyData(sourceId, newTallyObj);
	}
}

function SetUpVMixServer(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);
	let ip = source.data.ip;
	let port = 8099;

	try
	{
		let sourceConnectionObj = {
            sourceId,
            server: null,
        };
		source_connections.push(sourceConnectionObj);

		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				logger(`Source: ${source.name}  Creating VMix connection.`, 'info-quiet');
				source_connections[i].server = new net.Socket();
				source_connections[i].server.connect(port, ip, () =>  {
					logger(`Source: ${source.name}  VMix Connection Opened.`, 'info');

					source_connections[i].server.write('SUBSCRIBE TALLY\r\n');
					source_connections[i].server.write('SUBSCRIBE ACTS\r\n');

					addVMixSource(sourceId, '{{RECORDING}}', 'Recording');
					addVMixSource(sourceId, '{{STREAMING}}', 'Streaming');

					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = true;
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

					const tallyData = data.filter(text => text.startsWith('TALLY OK'));

					if (tallyData.length > 0) {
						logger(`Source: ${source.name}  VMix tally data received.`, 'info-quiet');
						for (let j = 9; j < tallyData[0].length; j++) {
							let address = j-9+1;
							let value = tallyData[0].charAt(j);

							//build an object like the TSL module creates so we can use the same function to process it
							let tallyObj: any = {};
							tallyObj.address = address.toString();
							tallyObj.brightness = 1;
							tallyObj.tally1 = ((value === '2') ? 1 : 0);
							tallyObj.preview = ((value === '2') ? 1 : 0);
							tallyObj.tally2 = ((value === '1') ? 1 : 0);
							tallyObj.program = ((value === '1') ? 1 : 0);
							tallyObj.tally3 = 0;
							tallyObj.tally4 = 0;
							tallyObj.label = `Input ${address}`;
							processSourceTallyData(sourceId, tallyObj);
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
							let tallyObj: any = {};
							tallyObj.address = '{{RECORDING}}';
							tallyObj.brightness = 1;
							tallyObj.tally1 = 0;
							tallyObj.preview = 0;
							tallyObj.tally2 = value;
							tallyObj.program = value;
							tallyObj.tally3 = 0;
							tallyObj.tally4 = 0;
							tallyObj.label = `Recording: ${value}`;
							processSourceTallyData(sourceId, tallyObj);
						}

						if (data[0].indexOf('ACTS OK Streaming ') > -1) {
							let value = false;
							if (data.indexOf('ACTS OK Streaming 1') > -1) {
								value = true;
							}
							//build an object like the TSL module creates so we can use the same function to process it
							let tallyObj: any = {};
							tallyObj.address = '{{STREAMING}}';
							tallyObj.brightness = 1;
							tallyObj.tally1 = 0;
							tallyObj.preview = 0;
							tallyObj.tally2 = value;
							tallyObj.program = value;
							tallyObj.tally3 = 0;
							tallyObj.tally4 = 0;
							tallyObj.label = `Streaming: ${value}`;
							processSourceTallyData(sourceId, tallyObj);
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

	for (let i = 0; i < source_connections.length; i++) {
		if (source_connections[i].sourceId === sourceId) {
			logger(`Source: ${source.name}  Closing VMix connection.`, 'info-quiet');
			source_connections[i].server.write('QUIT\r\n');
			break;
		}
	}
}

function SetUpPanasonicServer(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);
	let ip = source.data.ip;
	let port = 60020;

	try
	{
		let sourceConnectionObj = {
            sourceId,
            server: null,
            multi: null,
            timer: null,
        };
		source_connections.push(sourceConnectionObj);

		var receivebuffer = ''
		let multicastAddress = '224.0.0.200'
		let multicastInterface = getNetworkInterfaces() // get network interfaces
		let multicastPort = 60020

		var STX = String.fromCharCode(0x02)
		var ETX = String.fromCharCode(0x03)
	
		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				logger(`Source: ${source.name}  Creating Panasonic AV-HS410 connection.`, 'info-quiet');

				// Post an array of inputs to the dropdowns
				addPanasonicSource(sourceId);


				source_connections[i].server = new net.Socket()
				source_connections[i].multi = dgram.createSocket({ type: 'udp4', reuseAddr: true })

				source_connections[i].server.connect(port, ip, () =>  {
					logger(`Source: ${source.name}  AV-HS410 Connection Opened.`, 'info');

					// source_connections[i].server.write('SUBSCRIBE TALLY\r\n');
					// source_connections[i].server.write('SUBSCRIBE ACTS\r\n');

					// addVMixSource(sourceId, '{{RECORDING}}', 'Recording');
					// addVMixSource(sourceId, '{{STREAMING}}', 'Streaming');

					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = true;
							break;
						}
					}
					UpdateSockets('sources');
					UpdateCloud('sources');
				});

				source_connections[i].server.on('data', function (data) {
					// Do nothing currently, we only really use the TCP to keep the connection alive
				});

				source_connections[i].server.on('error', function(error) {
					logger(`Source: ${source.name}  Panasonic AV-HS410 Error occurred: ${error}`, 'error')
				});

				source_connections[i].server.on('close', function () {
					logger(`Source: ${source.name}  Panasonic AV-HS410 Connection closed.`, 'info')
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = false;
							break;
						}
					}
					UpdateSockets('sources')
					UpdateCloud('sources')
				});

				source_connections[i].multi.on('listening', function () {
					logger(`Source: ${source.name}  Panasonic AV-HS410 Multicast Enabled.`, 'info')
				})

				source_connections[i].multi.on('message', function (message, remote) {
					var i = 0,
						packet = '',
						offset = 0
					receivebuffer += message
			
					// If we receve a data package from the unit - Parse it
					while ((i = receivebuffer.indexOf(ETX, offset)) !== -1) {
						packet = receivebuffer.substr(offset, i - offset)
						offset = i + 1
			
						if (packet.substr(0, 1) == STX) {
							let str_raw = packet.substr(1).toString()
							// Ready for feedbacks on multicast data
							let stri = str_raw.trim() // remove new line, carage return and so on.
							let str = stri.split(':') // Split Commands and data

							// Create needed Variables for temp data
							let address = parseInt(str[2]) + 1;
							let input: any = {}
							let old_input: any = {}
							let change = false
							
							// Clear the old input from program
							switch (str[0]) {
								case 'ABST':
									switch (str[1]) {
										case '00': // Bus A
											// Do something
											break 
										case '01': // Bus B
											// Do something
											break 
										case '02': // PGM
											// Clear the old input from Program Bus
											old_input = tallydata_Panasonic.find( (inputs) => inputs.tally2 === 1)
											if (old_input != undefined) {
												if (old_input.tally2 != undefined) {
													if (old_input.address != String(address)) {
														old_input.tally2 = 0;
														old_input.program = 0;											
													}
												}	
											}

											// Set the new input to Program Bus
											input = tallydata_Panasonic.find( (inputs) => inputs.address === String(address))
											if (input != undefined) {
												if (input.tally2 != undefined) {
													if (input.tally2 != 1) {
														input.tally2 = 1;
														input.program = 1;
														change = true;
													} else {
														change = false;	
													}
												}	
											}
											break 
										case '03': // PVW
											// Clear the old input from Preview Bus
											old_input = tallydata_Panasonic.find( (inputs) => inputs.tally1 === 1)
											if (old_input != undefined) {
												if (old_input.tally1 != undefined) {
													if (old_input.address != String(address)) {
														old_input.tally1 = 0;
														old_input.preview = 0;											
													}
												}	
											}

											// Set the new input to Preview Bus
											input = tallydata_Panasonic.find( (inputs) => inputs.address === String(address))
											if (input != undefined) {
												if (input.tally1 != undefined) {
													if (input.tally1 != 1) {
														input.tally1 = 1;
														input.preview = 1;
														change = true;
													} else {
														change = false;	
													}
												}	
											}
											break 
										case '04': // Key Fill
											// Do something
											break 
										case '05': // Key Source
											// Do something
											break 
										case '06': // DSK Fill
											// Do something
											break 
										case '07': // DSK Source
											// Do something
											break 
										case '10': // PinP 1
											// Do something
											break 
										case '11': // PinP 2
											// Do something
											break 
										case '12': // AUX 1
											// Do something
											break 
										case '13': // AUX 2
											// Do something
											break 
										case '14': // AUX 3
											// Do something
											break 
										case '15': // AUX 4
											// Do something
											break 
										default:
											break
									}
									break
								case 'ATST':
									break // Store some data when ATST command is recieved
								case 'SPAT':
									break // Store some data when SPAT command is recieved
						
								default:
									break
							}

							if (change == true) {
								if (old_input != undefined) {
									processSourceTallyData(sourceId, old_input);
								}
								if (input != undefined) {
									processSourceTallyData(sourceId, input);
								}
							}
						}
					}
					receivebuffer = receivebuffer.substr(offset)
				})
			
				source_connections[i].multi.on('error', function (err) {
					logger(`Source: ${source.name}  Panasonic Multicast Error occurred: ${err.stack}`, 'error')
				})
			
				source_connections[i].multi.bind(multicastPort, () => {
					for (let x = 0; x < multicastInterface.length; x++) {
						source_connections[i].multi.addMembership(multicastAddress, multicastInterface[x].address)
					}
				})			
			
				source_connections[i].timer = setInterval(function () {					
					// if (source_connections[i].server !== undefined && source_connections[i].server.connected) {
					if (source_connections[i].server !== undefined) {
						source_connections[i].server.write(STX + 'SPAT:0:00' + ETX)
						// console.log('send: SPAT:0:00')
					} else {
						logger(`Source: ${source.name}  Panasonic AV-HS410 Connection Lost.`, 'info')
					}
				
				}, 500) // 500 ms keepalive command
	
				break;
			}
		}
	}
	catch (error) {
		logger(`Source: ${source.name}. Panasonic AV-HS410 Error Occurred: ${error}`, 'error');
	}
}

function addPanasonicSource(sourceId) {
	let inputs = source_types_panasonic

	inputs.forEach( input => {
		let address = String(parseInt(input.id) + 1)

		//Double check its not there already
		var exists = tallydata_Panasonic.find(function(src){
			return (src.sourceId == sourceId && src.address == address);
		});

	    if (exists !== undefined) return;

		// //Doesn't exist, add it
		tallydata_Panasonic.push({
		    sourceId: sourceId,
		    label: input.label,
		    address: address,
		    tally1: 0,
		    tally2: 0,
		    tally3: 0,
		    tally4: 0
		});

		logger(`AV-HS410 Tally Source: ${sourceId} Added new source: ${input.label}`, 'info-quiet');
	});	

	// console.log(tallydata_Panasonic)
}

function StopPanasonicServer(sourceId) {
	let source = GetSourceBySourceId(sourceId);

	for (let i = 0; i < source_connections.length; i++) {
		if (source_connections[i].sourceId === sourceId) {

			// Close TCP Keep Alive Requests
			if (source_connections[i].timer) {
				clearInterval(source_connections[i].timer)
				delete source_connections[i].timer
			}

			// Close UDP Multicast Interface
			if (source_connections[i].multi !== undefined) {
				source_connections[i].multi.close()
				delete source_connections[i].multi
			}
		
			logger(`Source: ${source.name}. Closing Panasonic AV-HS410 Connection.`, 'info-quiet');
			source_connections[i].server.write('QUIT\r\n');
			break;
		}
	}
}

function SetUpRolandSmartTally(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);

	try {
		let sourceConnectionObj = {
            sourceId,
            server: null,
        };
		source_connections.push(sourceConnectionObj);

		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				logger(`Source: ${source.name}  Opening Roland Smart Tally connection.`, 'info-quiet');
				for (let j = 0; j < sources.length; j++) {
					if (sources[j].id === sourceId) {
						sources[j].connected = true;
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
				let tallyObj: any = {};
				tallyObj.address = address;
				tallyObj.label = address;
				tallyObj.tally4 = 0;
				tallyObj.tally3 = 0;
				tallyObj.tally2 = 0;
				tallyObj.tally1 = 0;
				tallyObj.preview = 0;
				tallyObj.program = 0;

				switch(response.data)
				{
					case "onair":
						tallyObj.tally2 = 1;
						tallyObj.program = 1;
						tallyObj.tally1 = 0;
						tallyObj.preview = 0;
						break;
					case "selected":
						tallyObj.tally2 = 0;
						tallyObj.program = 0;
						tallyObj.tally1 = 1;
						tallyObj.preview = 1;
						break;
					case "unselected":
					default:
						tallyObj.tally2 = 0;
						tallyObj.program = 0;
						tallyObj.tally1 = 0;
						tallyObj.preview = 1;
						break;
				}
				processSourceTallyData(sourceId, tallyObj);
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
		let sourceConnectionObj = {
            sourceId,
            server: null,
        };
		source_connections.push(sourceConnectionObj);

		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				logger(`Source: ${source.name}  Creating Roland VR Connection.`, 'info-quiet');
				source_connections[i].server = new net.Socket();
				source_connections[i].server.connect({port: port, host: ip}, () =>  {
					let tallyCmd = '\u0002CPG:1;';
					source_connections[i].server.write(tallyCmd + '\n');
					logger(`Source: ${source.name}  Roland VR Connection opened. Listening for data.`, 'info');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = true;
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
								let tallyObj: any = {};
								tallyObj.address = j;
								tallyObj.label = j;
								tallyObj.tally1 = 0;
								tallyObj.preview = 0;
								tallyObj.tally2 = 0;
								tallyObj.program = 0;
								processSourceTallyData(sourceId, tallyObj);
							}
							//now enter the new PGM value based on the received data
							let tallyObj: any = {};
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
							tallyObj.preview = 0;
							tallyObj.tally2 = 1;
							tallyObj.program = 1;
							processSourceTallyData(sourceId, tallyObj);
						}
					}
					catch(error) {
						logger(`Source: ${source.name}  Roland VR Connection Error occurred: ${error}`, 'error');
					}
				});

				source_connections[i].server.on('close', () =>  {

					logger(`Source: ${source.name}  Roland VR Connection Stopped.`, 'info');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = false;
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
			let sourceConnectionObj = {
                sourceId,
                server: null,
            };
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
	
			let sourceConnectionObj = {
                sourceId,
                server: null,
            };
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
						});
					}).listen(port, () =>  {
						logger(`Source: ${source.name}  Ross Carbonite Server started. Listening for data on TCP Port: ${port}`, 'info');
						for (let j = 0; j < sources.length; j++) {
							if (sources[j].id === sourceId) {
								sources[j].connected = true;
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
	let labelAddress = parseInt(tallyObj.label.substring(0, tallyObj.label.indexOf(':'))) as any;

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
        let tallyObj = {
            sourceId,
            busses: [busAddress],
            address,
        };
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
					let bus = undefined; /* source_types_busaddresses.find( (busAddress) => {
							if ((busAddress.sourceTypeId === sourceTypeId) && (busAddress.address === busses[j])) {
								return true;
                        }
                        return false;
						}); */
					// ToDo
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

				let newTallyObj: any = {};
				newTallyObj.address = address;
				newTallyObj.tally1 = (inPreview ? 1 : 0);
				newTallyObj.preview = (inPreview ? 1 : 0);
				newTallyObj.tally2 = (inProgram ? 1 : 0);
				newTallyObj.program = (inProgram ? 1 : 0);
				// ToDo: update
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

		try
		{
			for (let i = 0; i < source_connections.length; i++) {
				if (source_connections[i].sourceId === sourceId) {
					source_connections[i].server.close(() =>  {});
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
		let sourceConnectionObj = {
            sourceId,
            server: null,
        };
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
					let tallyObj: any = {};
					tallyObj.address = oscMsg.args[0].value.toString();
					tallyObj.label = tallyObj.address;
					switch(oscMsg.address) {
						case '/tally/preview_on':
							tallyObj.tally1 = 1;
							tallyObj.preview = 1;
							break;
						case '/tally/preview_off':
							tallyObj.tally1 = 0;
							tallyObj.preview = 0;
							break;
						case '/tally/program_on':
							tallyObj.tally2 = 1;
							tallyObj.program = 1;
							break;
						case '/tally/program_off':
							tallyObj.tally2 = 0;
							tallyObj.program = 0;
							break;
						case '/tally/previewprogram_off':
							tallyObj.tally1 = 0;
							tallyObj.preview = 0;
							tallyObj.tally2 = 0;
							tallyObj.program = 0;
							break;
						case '/tally/previewprogram_on':
							tallyObj.tally1 = 1;
							tallyObj.preview = 1;
							tallyObj.tally2 = 1;
							tallyObj.program = 1;
							break;
						default:
							break;
					}
					processSourceTallyData(source.id, tallyObj);
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
		let sourceConnectionObj = {
            sourceId,
            server: null,
        };
		source_connections.push(sourceConnectionObj);

		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				logger(`Source: ${source.name}  Creating Tricaster Connection.`, 'info-quiet');
				source_connections[i].server = new net.Socket();
				source_connections[i].server.connect({port: port, host: ip}, () =>  {
					let tallyCmd = '<register name="NTK_states"/>';
					source_connections[i].server.write(tallyCmd + '\n');
					logger(`Source: ${source.name}  Tricaster Connection opened. Listening for data.`, 'info');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = true;
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

				source_connections[i].server.on('close', () =>  {

					logger(`Source: ${source.name}  Tricaster Connection Stopped.`, 'info');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = false;
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
			let tricasterTallyObj: any = {};
			tricasterTallyObj.sourceId = sourceId;
			tricasterTallyObj.label = sourceArray[i];
			tricasterTallyObj.address = sourceArray[i];
			tricasterTallyObj.tally4 = 0;
			tricasterTallyObj.tally3 = 0;
			tricasterTallyObj.tally2 = 0; // PGM
			tricasterTallyObj.tally1 = 0; // PVW
			tricasterTallyObj.preview = 0;
			tricasterTallyObj.program = 0;
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
							tallydata_TC[i].preview = 1;
							break;
						case 'program_tally':
							tallydata_TC[i].tally2 = 1;
							tallydata_TC[i].program = 1;
							break;
						default:
							break;
					}
					processSourceTallyData(sourceId, tallydata_TC[i]);
					break;
				}
			}
		}

		if (!tricasterSourceFound) {
			//it is no longer in the bus, mark it as such
			switch(tallyType) {
				case 'preview_tally':
					tallydata_TC[i].tally1 = 0;
					tallydata_TC[i].preview = 0;
					break;
				case 'program_tally':
					tallydata_TC[i].tally2 = 0;
					tallydata_TC[i].program = 0;
					break;
				default:
					break;
			}
			processSourceTallyData(sourceId, tallydata_TC[i]);
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

function SetUpAWLivecoreServer(sourceId) {
	let source = sources.find( ({ id }) => id === sourceId);
	let ip = source.data.ip;
	let port = source.data.port;

	try
	{
		let sourceConnectionObj: any = {};
		sourceConnectionObj.sourceId = sourceId;
		sourceConnectionObj.server = null;
		source_connections.push(sourceConnectionObj);

		for (let i = 0; i < source_connections.length; i++) {
			if (source_connections[i].sourceId === sourceId) {
				logger(`Source: ${source.name}  Creating AW Livecore connection.`, 'info-quiet');
				source_connections[i].server = new net.Socket();
				source_connections[i].server.connect(port, ip, () =>  {
					logger(`Source: ${source.name}  AW Livecore Connection Opened.`, 'info');
					source_connections[i].server.write('?\n');
					for (let j = 0; j < sources.length; j++) {
						if (sources[j].id === sourceId) {
							sources[j].connected = true;
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

					const deviceState = data.filter(text => text.startsWith('PCdgs'));
					const deviceData = data.filter(text => text.startsWith('DEV'));
					const tallyProgramData = data.filter(text => text.startsWith('TAopr'));
					const tallyPreviewData = data.filter(text => text.startsWith('TAopw'));

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

						let tallyObj: any = {};
						tallyObj.address = address.toString();
						tallyObj.tally2 = ((value === '1') ? 1 : 0); // Program
						tallyObj.program = ((value === '1') ? 1 : 0); // Program
						tallyObj.label = `Input ${address}`;
						processAWLivecoreTally(sourceId, tallyObj);
					}

					if (tallyPreviewData.length > 0) {
						logger(`Source: ${source.name}  AW Livecore tally preview data received.`, 'info-quiet');

						let address = tallyPreviewData[0].substring(5, tallyPreviewData[0].indexOf(','));
						let value = tallyPreviewData[0].charAt(tallyPreviewData[0].indexOf(',') + 1);

						let tallyObj: any = {};
						tallyObj.address = address.toString();
						tallyObj.tally1 = ((value === '1') ? 1 : 0); // Preview
						tallyObj.preview = ((value === '1') ? 1 : 0); // Preview
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
		let newTallyObj: any = {};
		newTallyObj.sourceId = sourceId;
		newTallyObj.label = tallyObj.label;
		newTallyObj.address = tallyObj.address;
		newTallyObj.tally4 = 0;
		newTallyObj.tally3 = 0;
		newTallyObj.tally2 = 0; // PGM
		newTallyObj.tally1 = 0; // PVW
		newTallyObj.preview = 0;
		newTallyObj.program = 0;
		tallydata_AWLivecore.push(newTallyObj);
	}

	for (let i = 0; i < tallydata_AWLivecore.length; i++) {
		if (tallydata_AWLivecore[i].sourceId === sourceId) {
			if (tallydata_AWLivecore[i].address === tallyObj.address) {
				if(tallyObj.tally1 !== undefined) { // PVW
					tallydata_AWLivecore[i].tally1 = tallyObj.tally1;
					tallydata_AWLivecore[i].preview = tallyObj.tally1;
				}
				if(tallyObj.tally2 !== undefined) { // PGM
					tallydata_AWLivecore[i].tally2 = tallyObj.tally2;
					tallydata_AWLivecore[i].program = tallyObj.tally2;
				}

				let processedTallyObj =  Object.assign({}, tallydata_AWLivecore[i]);
				if(processedTallyObj.tally2 === 1) { // PGM
					processedTallyObj.tally1 = 0;
					processedTallyObj.preview = 0;
				}

				processSourceTallyData(sourceId, processedTallyObj);
				break;
			}
		}
	}
}

function processSourceTallyData(sourceId: string, tallyData: SourceTallyData)
{
	writeTallyDataFile(tallyData);

	io.to('settings').emit('tally_data', sourceId, tallyData);
	
	currentSourceTallyData = {
		...currentSourceTallyData,
		...tallyData,
	};

	for (const device of devices) {
		UpdateDeviceState(device.id);
	}
}

function RenameDevice(deviceId, name) {
	//renames the Device with the new name that originated in the source type

	for (let i = 0; i < devices.length; i++) {
		if (devices[i].id === deviceId) {
			if (name) {
				devices[i].name = name;
			}
			break;
		}
	}

	UpdateSockets('devices');
	SendTSLClientData(deviceId);
}

function RunAction(deviceId, busId, active) {
	let actionObj: DeviceAction = null;

	let deviceObj = GetDeviceByDeviceId(deviceId);

	if (deviceObj.enabled === true) {
		let filteredActions = device_actions.filter(obj => obj.deviceId === deviceId);
		if (filteredActions.length > 0) {
			for (let i = 0; i < filteredActions.length; i++) {
				if ((filteredActions[i].busId === busId) && (filteredActions[i].active === active)) {
					logger(`Running Actions for Device: ${deviceObj.name}`, 'info');
					actionObj = filteredActions[i];

					logger(`Running action: ${deviceObj.name}:${GetBusByBusId(filteredActions[i].busId).label}:${(active ? 'On' : 'Off')}  ${filteredActions[i].id}`, 'info');

					const action = new Actions[actionObj.outputTypeId].cls(actionObj);
					action.run();
				}
			}
		}
	}
	else {
		//the device is disabled, so don't run any actions against it
		logger(`Device: ${deviceObj.name} is not enabled, so no actions will be run.`, 'info');
	}
}

function TallyArbiter_Manage(obj: Manage): ManageResponse {
    let result: ManageResponse;
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
		case 'bus_option':
			if (obj.action === 'add') {
				result = TallyArbiter_Add_Bus_Option(obj);
			}
			else if (obj.action === 'edit') {
				result = TallyArbiter_Edit_Bus_Option(obj);
			}
			else if (obj.action === 'delete') {
				result = TallyArbiter_Delete_Bus_Option(obj);
			}
			io.emit('bus_options', bus_options); //emit the new bus options array to everyone
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

function StopConnection(sourceId: string) {
	SourceClients[sourceId]?.exit();
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
					tsl_clients[i].socket.on('connect', () =>  {
						logger(`TSL Client ${tslClientId} Connection Established: ${tsl_clients[i].ip}:${tsl_clients[i].port}`, 'info-quiet');
						tsl_clients[i].error = false;
						tsl_clients[i].connected = true;
						UpdateSockets('tsl_clients');
					});
					tsl_clients[i].socket.on('close', () =>  {
						if (tsl_clients[i]) {
							logger(`TSL Client ${tslClientId} Connection Closed: ${tsl_clients[i].ip}:${tsl_clients[i].port}`, 'info-quiet');
							tsl_clients[i].error = false;
							tsl_clients[i].connected = false;
							UpdateSockets('tsl_clients');
						}
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
					tsl_clients[i].socket.on('connect', () =>  {
						logger(`TSL Client ${tslClientId} Connection Established: ${tsl_clients[i].ip}:${tsl_clients[i].port}`, 'info-quiet');
						tsl_clients[i].error = false;
						tsl_clients[i].connected = true;
						UpdateSockets('tsl_clients');
					});
					tsl_clients[i].socket.on('close', function () {
						if (tsl_clients[i]) {
							logger(`TSL Client ${tslClientId} Connection Closed: ${tsl_clients[i].ip}:${tsl_clients[i].port}`, 'info-quiet');
							tsl_clients[i].error = false;
							tsl_clients[i].connected = false;
							UpdateSockets('tsl_clients');
						}
					});
					tsl_clients[i].socket.connect(parseInt(tsl_clients[i].port as string), tsl_clients[i].ip);
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

	let filtered_currentTallyData = currentDeviceTallyData as any;

	let tslAddress = (device.tslAddress) ? parseInt(device.tslAddress) : -1;

	let mode_preview = false;
	let mode_program = false;

	if (tslAddress !== -1) {
		let bufUMD = Buffer.alloc(18, 0); //ignores spec and pad with 0 for better aligning on Decimator etc
		bufUMD[0] = 0x80 + tslAddress;
		bufUMD.write(device.name, 2);

		for (let i = 0; i < filtered_currentTallyData.length; i++) {
			if (GetBusByBusId(filtered_currentTallyData[i].busId).type === 'preview') {
				if (filtered_currentTallyData[i].sources.length > 0) {
					mode_preview = true;
				}
				else {
					mode_preview = false;
				}
			}
			else if (GetBusByBusId(filtered_currentTallyData[i].busId).type === 'program') {
				if (filtered_currentTallyData[i].sources.length > 0) {
					mode_program = true;
				}
				else {
					mode_program = false;
				}
			}
			//could add support for other states here like tally3, tally4, whatever the TSL protocol supports
		}

		let data: any = {};

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
							tsl_clients[i].socket.send(bufUMD, parseInt(tsl_clients[i].port as string), tsl_clients[i].ip);
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
		logger('Starting TSL Clients 1 Second Interval.', 'info');
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

    let cloudDestinationSocketObj = {
        id: cloudDestinationId,
        socket: null,
        host: cloud_destination.host,
        port: cloud_destination.port,
        key: cloud_destination.key,
    };
	cloud_destinations_sockets.push(cloudDestinationSocketObj);

	for (let i = 0; i < cloud_destinations_sockets.length; i++) {
		if (cloud_destinations_sockets[i].id === cloudDestinationId) {
			logger(`Cloud Destination: ${cloud_destinations_sockets[i].host}:${cloud_destinations_sockets[i].port}  Initiating Connection.`, 'info-quiet');

			cloud_destinations_sockets[i].socket = ioClient('http://' + cloud_destinations_sockets[i].host + ':' + cloud_destinations_sockets[i].port, {reconnection: true});

			cloud_destinations_sockets[i].socket.on('connect', () =>  { 
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

			cloud_destinations_sockets[i].socket.on('disconnect', () =>  { 
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

function UpdateCloud(dataType: 'sources' | 'devices' | 'device_sources' | 'currentTallyData' | 'listener_clients' | 'vmix_clients' | 'tsl_clients' | 'cloud_destinations' | 'cloud_clients' | "PortsInUse") {
	for (let i = 0; i < cloud_destinations_sockets.length; i++) {
		if (cloud_destinations_sockets[i].connected === true) {
			try {
				switch(dataType) {
					case 'sources':
						cloud_destinations_sockets[i].socket.emit('cloud_sources', cloud_destinations_sockets[i].key, getSources());
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

type SocketUpdateDataType = 'sources' | 'devices' | 'device_sources' | 'currentTallyData' | 'listener_clients' | 'vmix_clients' | 'tsl_clients' | 'cloud_destinations' | 'cloud_clients' | "PortsInUse" | "addresses";

function UpdateSockets(dataType: SocketUpdateDataType) {
	const data: Record<SocketUpdateDataType, () => any> = {
		PortsInUse: () => PortsInUse,
		addresses: () => addresses.value,
		sources: () => getSources(),
		devices: () => devices,
		device_sources: () => device_sources,
		currentTallyData: () => currentDeviceTallyData, 
		listener_clients: () => listener_clients, 
		vmix_clients: () => vmix_client_data, 
		tsl_clients: () => tsl_clients, 
		cloud_destinations: () => cloud_destinations, 
		cloud_clients: () => cloud_clients,
	}
	const emitTo = (to: string) => {
		io.to(to).emit(dataType, data[dataType]());
	}
	
	if (socketupdates_Settings.includes(dataType)) {
		emitTo("settings");
	}

	if (socketupdates_Producer.includes(dataType)) {
		emitTo('producer');
	}

	if (socketupdates_Companion.includes(dataType)) {
		emitTo('companion');
	}
}

function UpdateVMixClients() {
	let vmixTallyString = 'TALLY OK ';

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
		let deviceId = devices[i].id;

		let inPreview = false;
		let inProgram = false;

		// ToDo
		/*for (let i = 0; i < currentTallyData.length; i++) {
			if (currentTallyData[i].deviceId === deviceId) {
				if (currentTallyData[i].busId === busId_preview) {
					if (currentTallyData[i].sources.length > 0) {
						inPreview = true;
					}
					else {
						inPreview = false;
					}
				}

				if (currentTallyData[i].busId === busId_program) {
					if (currentTallyData[i].sources.length > 0) {
						inProgram = true;
					}
					else {
						inProgram = false;
					}
				}
			}
		} */

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

function TallyArbiter_Add_Source(obj): ManageResponse {
	let sourceObj = obj.source as Source;
	sourceObj.id = uuidv4();
	sources.push(sourceObj);

	UpdateCloud('sources');

	logger(`Source Added: ${sourceObj.name}`, 'info');

	initializeSource(sourceObj);

	return {result: 'source-added-successfully'};
}

function TallyArbiter_Edit_Source(obj): ManageResponse {
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
			SourceClients[sourceObj.id]?.reconnect();
		}
	}
	else {
		StopConnection(sourceObj.id);
	}

	return {result: 'source-edited-successfully'};
}

function TallyArbiter_Delete_Source(obj): ManageResponse {
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

	/* for (let i = currentTallyData.length - 1; i >=0; i--) {
		for (let j = currentTallyData[i].sources.length - 1; j >=0; j--) {
			if (currentTallyData[i].sources[j] === sourceId) {
				currentTallyData[i].sources.splice(j, 1);
				break;
			}
		}
	} */

	UpdateSockets('currentTallyData');

	logger(`Source Deleted: ${sourceName}`, 'info');

	return {result: 'source-deleted-successfully'};
}

function TallyArbiter_Add_Device(obj): ManageResponse {
	let deviceObj = obj.device;
	deviceObj.id = uuidv4();
	devices.push(deviceObj);

	UpdateCloud('devices');

	UpdateDeviceState(deviceObj.id);

	SendTSLClientData(deviceObj.id);

	logger(`Device Added: ${deviceObj.name}`, 'info');

	return {result: 'device-added-successfully'};
}

function TallyArbiter_Edit_Device(obj): ManageResponse {
	let deviceObj = obj.device;
	for (let i = 0; i < devices.length; i++) {
		if (devices[i].id === deviceObj.id) {
			devices[i].name = deviceObj.name;
			devices[i].description = deviceObj.description;
			devices[i].tslAddress = deviceObj.tslAddress;
			devices[i].enabled = deviceObj.enabled;
			devices[i].linkedBusses = deviceObj.linkedBusses;
		}
	}

	SendTSLClientData(deviceObj.id);

	UpdateCloud('devices');

	logger(`Device Edited: ${deviceObj.name}`, 'info');

	return {result: 'device-edited-successfully'};
}

function TallyArbiter_Delete_Device(obj): ManageResponse {
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

function TallyArbiter_Add_Device_Source(obj): ManageResponse {
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

function TallyArbiter_Edit_Device_Source(obj): ManageResponse {
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
		device_sources[i].rename = deviceSourceObj.rename;
	}

	let deviceName = GetDeviceByDeviceId(deviceId).name;
	let sourceName = GetSourceBySourceId(deviceSourceObj.sourceId).name;

	UpdateCloud('device_sources');

	logger(`Device Source Edited: ${deviceName} - ${sourceName}`, 'info');

	return {result: 'device-source-edited-successfully', deviceId: deviceId};
}

function TallyArbiter_Delete_Device_Source(obj): ManageResponse {
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

	delete currentDeviceTallyData[deviceSourceId];

	let deviceName = GetDeviceByDeviceId(deviceId).name;
	let sourceName = GetSourceBySourceId(sourceId).name;

	UpdateCloud('device_sources');

	logger(`Device Source Deleted: ${deviceName} - ${sourceName}`, 'info');

	return {result: 'device-source-deleted-successfully', deviceId: deviceId};
}

function TallyArbiter_Add_Device_Action(obj): ManageResponse {
	let deviceActionObj = obj.device_action;
	let deviceId = deviceActionObj.deviceId;
	deviceActionObj.id = uuidv4();
	device_actions.push(deviceActionObj);

	let deviceName = GetDeviceByDeviceId(deviceActionObj.deviceId).name;

	logger(`Device Action Added: ${deviceName}`, 'info');

	return {result: 'device-action-added-successfully', deviceId: deviceId};
}

function TallyArbiter_Edit_Device_Action(obj): ManageResponse {
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

	logger(`Device Action Edited: ${deviceName}`, 'info');

	return {result: 'device-action-edited-successfully', deviceId: deviceId};
}

function TallyArbiter_Delete_Device_Action(obj): ManageResponse {
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

	logger(`Device Action Deleted: ${deviceName}`, 'info');

	return {result: 'device-action-deleted-successfully', deviceId: deviceId};
}

function TallyArbiter_Add_TSL_Client(obj): ManageResponse {
	let tslClientObj = obj.tslClient;
	tslClientObj.id = uuidv4();
	tsl_clients.push(tslClientObj);

	logger(`TSL Client Added: ${tslClientObj.ip}:${tslClientObj.port} (${tslClientObj.transport})`, 'info');

	StartTSLClientConnection(tslClientObj.id);

	return {result: 'tsl-client-added-successfully'};
}

function TallyArbiter_Edit_TSL_Client(obj): ManageResponse {
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

function TallyArbiter_Delete_TSL_Client(obj): ManageResponse {
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

function TallyArbiter_Add_Bus_Option(obj): ManageResponse {
	let busOptionObj = obj.busOption;
	busOptionObj.id = uuidv4();
	bus_options.push(busOptionObj);

	logger(`Bus Option Added: ${busOptionObj.label}:${busOptionObj.type} (${busOptionObj.color})`, 'info');

	return {result: 'bus-option-added-successfully'};
}

function TallyArbiter_Edit_Bus_Option(obj): ManageResponse {
	let busOptionObj = obj.busOption;

	for (let i = 0; i < bus_options.length; i++) {
		if (bus_options[i].id === busOptionObj.id) {
			bus_options[i].label = busOptionObj.label;
			bus_options[i].type = busOptionObj.type;
			bus_options[i].color = busOptionObj.color;
			break;
		}
	}

	logger(`Bus Option Edited: ${busOptionObj.label}:${busOptionObj.type} (${busOptionObj.color})`, 'info');

	return {result: 'bus-option-edited-successfully'};
}

function TallyArbiter_Delete_Bus_Option(obj): ManageResponse {
	let busOptionObj = GetBusByBusId(obj.busOptionId);
	let busOptionId = obj.busOptionId;

	for (let i = 0; i < bus_options.length; i++) {
		if (bus_options[i].id === busOptionId) {
			bus_options.splice(i, 1);
			break;
		}
	}

	logger(`Bus Option Deleted: ${busOptionObj.label}:${busOptionObj.type} (${busOptionObj.color})`, 'info');

	return {result: 'bus-option-deleted-successfully'};
}

function TallyArbiter_Add_Cloud_Destination(obj): ManageResponse {
	let cloudObj = obj.cloudDestination;
	cloudObj.id = uuidv4();
	cloud_destinations.push(cloudObj);

	logger(`Cloud Destination Added: ${cloudObj.host}:${cloudObj.port}`, 'info');

	StartCloudDestination(cloudObj.id);

	return {result: 'cloud-destination-added-successfully'};
}

function TallyArbiter_Edit_Cloud_Destination(obj): ManageResponse {
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

function TallyArbiter_Delete_Cloud_Destination(obj): ManageResponse {
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

function TallyArbiter_Add_Cloud_Key(obj): ManageResponse {
	cloud_keys.push(obj.key);

	logger(`Cloud Key Added: ${obj.key}`, 'info');

	return {result: 'cloud-key-added-successfully'};
}

function TallyArbiter_Delete_Cloud_Key(obj): ManageResponse {
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

function TallyArbiter_Remove_Cloud_Client(obj): ManageResponse {
	let ipAddress = null;
	let key = null;
	let clientRemoved = false;
	for (let i = 0; i < cloud_clients.length; i++) {
		if (cloud_clients[i].id === obj.id) {
			//disconnect the cloud client
			ipAddress = cloud_clients[i].ipAddress;
			key = cloud_clients[i].key;
			if ((io.sockets as any).connected && (io.sockets as any).connected.includes(cloud_clients[i].socketId)) {
				(io.sockets as any).connected[cloud_clients[i].socketId].disconnect(true);
				clientRemoved = true;
			}
			cloud_clients.splice(i, 1);
			break;
		}
	}

	if(clientRemoved){
		logger(`Cloud Client Removed: ${obj.id}  ${ipAddress}  ${key}`, 'info');
		return {result: 'cloud-client-removed-successfully'};
	} else {
		return {result: 'cloud-client-not-removed', error: 'Cloud client not found.' };
	}
}

function GetSourceBySourceId(sourceId: string): Source {
	//gets the Source object by id
	return sources.find( ({ id }) => id === sourceId);
}

function GetSourceTypeBySourceTypeId(sourceTypeId: string): SourceType {
	//gets the Source Type object by id
	return getSourceTypes().find( ({ id }) => id === sourceTypeId);
}

function GetBusByBusId(busId: string): BusOption {
	//gets the Bus object by id
	return bus_options.find( ({ id }) => id === busId);
}

function GetDeviceByDeviceId(deviceId: string): Device {
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

function GetDeviceSourcesBySourceId(sourceId): DeviceSource[] {
	return device_sources.filter(obj => obj.sourceId === sourceId);
}

function GetDeviceSourcesByDeviceId(deviceId): DeviceSource[] {
	return device_sources.filter(obj => obj.deviceId === deviceId);
}

function GetTSLClientById(tslClientId: string): TSLClient {
	//gets the TSL Client by the Id
	return tsl_clients.find( ({ id }) => id === tslClientId);
}

function GetCloudDestinationById(cloudId: string): CloudDestination {
	//gets the Cloud Destination by the Id
	return cloud_destinations.find( ({ id }) => id === cloudId);
}

function GetCloudClientById(cloudClientId: string): CloudClient {
	//gets the Cloud Client by the Id
	return cloud_clients.find( ({ id }) => id === cloudClientId);
}

function GetCloudClientBySocketId(socket: string): CloudClient {
	//gets the Cloud Client by the Socket Id
	return cloud_clients.find( ({ socketId }) => socketId === socket);
}


function GetSmartTallyStatus(tallynumber: number | string): string {
	//returns unselected, selected, or onair based on the tallynumber (index+1) passed
	let i = parseInt(tallynumber as string) - 1;

	let mode_preview = false;
	let mode_program = false;

	// ToDo
	/* for (let j = 0; j < currentTallyData.length; j++) {
		if ((currentTallyData[j].deviceId === devices[i].id) && (GetBusByBusId(currentTallyData[j].busId).type === 'preview')) {
			if (currentTallyData[j].sources.length > 0) {
				mode_preview = true;
			}
			else {
				mode_preview = false;
			}
		}
		else if ((currentTallyData[j].deviceId === devices[i].id) && (GetBusByBusId(currentTallyData[j].busId).type === 'program')) {
			if (currentTallyData[j].sources.length > 0) {
				mode_program = true;
			}
			else {
				mode_program = false;
			}
		}
	}*/

	let return_val = 'unselected';

	if (mode_program) {
		return_val = 'onair';
	}
	else if (mode_preview) {
		return_val = 'selected';
	}

	return return_val;
}

function AddListenerClient(socketId: string, deviceId: string, listenerType: string, ipAddress: string, datetimeConnected: number, canBeReassigned = true, canBeFlashed = true, supportsChat = false): string {
    let clientObj: ListenerClient = {
        id: uuidv4(),
        socketId: socketId,
        deviceId: deviceId,
        listenerType: listenerType,
        ipAddress: ipAddress,
        datetime_connected: datetimeConnected,
        canBeReassigned: canBeReassigned,
        canBeFlashed: canBeFlashed,
        supportsChat: supportsChat,
        inactive: false,
    };

	//search through the array of existing clients, and if the deviceId, listenerType, and ipAddress are the same, it's probably the same client as before, just reconnecting
	//so don't add it to the array as new; just target the existing clientId, update the socketId, and mark inactive=false

	let found = false;

	for (let i = 0; i < listener_clients.length; i++) {
		if (listener_clients[i].deviceId === clientObj.deviceId) {
			if (listener_clients[i].listenerType === clientObj.listenerType) {
				if (listener_clients[i].ipAddress === clientObj.ipAddress) {
					if (listener_clients[i].inactive) {
						//this is probably the same one
						found = true;
						listener_clients[i].socketId = clientObj.socketId;
						listener_clients[i].inactive = false;
						listener_clients[i].datetime_connected = clientObj.datetime_connected;
						listener_clients[i].canBeReassigned = clientObj.canBeReassigned;
						listener_clients[i].canBeFlashed = clientObj.canBeFlashed;
						listener_clients[i].supportsChat = clientObj.supportsChat;
						clientObj.id = listener_clients[i].id;
					}
				}
			}
		}
	}

	if (!found) {
		listener_clients.push(clientObj);
	}

	let message = `Listener Client Connected: ${clientObj.ipAddress.replace('::ffff:', '')} (${clientObj.listenerType}) at ${new Date()}`;
	SendMessage('server', null, message);

	for (const device of devices) {
		UpdateListenerClients(device.id);
	}

	UpdateSockets('listener_clients');
	UpdateCloud('listener_clients');

	return clientObj.id;
}

function UpdateListenerClients(deviceId: string) {
	const device = GetDeviceByDeviceId(deviceId);
	for (const listenerClient of listener_clients.filter((l) => l.deviceId == deviceId && !l.inactive)) {
		logger(`Sending device states to Listener Client: ${listenerClient.id} - ${device.name}`, 'info-quiet');
		io.to(listenerClient.socketId).emit('currentTallyData', currentDeviceTallyData);
		
	}
}

function ReassignListenerClient(clientId: string, oldDeviceId: string, deviceId: string) {
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

function DeactivateVmixListenerClient(socketId) {
	for (let i = 0; i < vmix_client_data.length; i++) {
		if (vmix_client_data[i].socketId === socketId) {
			vmix_client_data[i].inactive = true;
			vmix_client_data[i].datetime_inactive = new Date().getTime();
			let message = `Listener Client Disconnected: ${vmix_client_data[i].host.replace('::ffff:', '')} at ${new Date()}`;
			SendMessage('server', null, message);
		}
	}

	console.log(vmix_client_data);

	UpdateSockets('vmix_clients');
	UpdateCloud('vmix_clients');
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

function DeleteInactiveVmixListenerClients() {
	let changesMade = false;
	for (let i = vmix_client_data.length - 1; i >= 0; i--) {
		if (vmix_client_data[i].inactive === true) {
			let dtNow = new Date().getTime();
			if ((dtNow - vmix_client_data[i].datetime_inactive) > (1000 * 60 * 60)) { //1 hour
				logger(`Inactive Client removed: ${vmix_client_data[i].id}`, 'info');
				vmix_client_data.splice(i, 1);
				changesMade = true;
			}
		}
	}

	if (changesMade) {
		UpdateSockets('vmix_clients');
		UpdateCloud('vmix_clients');
	}

	setTimeout(DeleteInactiveVmixListenerClients, 5 * 1000); // runs every 5 minutes
}

function FlashListenerClient(listenerClientId): FlashListenerClientResponse | void {
	let listenerClientObj = listener_clients.find( ({ id }) => id === listenerClientId);

	if (listenerClientObj) {
		if (listenerClientObj.cloudConnection) {
			let cloudClientSocketId = GetCloudClientById(listenerClientObj.cloudClientId).socketId;
			if ((io.sockets as any).connected && (io.sockets as any).connected.includes(cloudClientSocketId)) {
				(io.sockets as any).connected[cloudClientSocketId].emit('flash', listenerClientId);
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

function MessageListenerClient(listenerClientId: { relayGroupId?: string; gpoGroupId?: string }, type: string, socketid: string, message: string): MessageListenerClientResponse | void {
	let listenerClientObj = listener_clients.find( ({ id }) => id === listenerClientId);

	if (listenerClientObj) {
		if (listenerClientObj.cloudConnection) {
			let cloudClientSocketId = GetCloudClientById(listenerClientObj.cloudClientId).socketId;
			if ((io.sockets as any).connected && (io.sockets as any).connected.includes(cloudClientSocketId)) {
				(io.sockets as any).connected[cloudClientSocketId].emit('messaging_client', listenerClientId, type, socketid, message);
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
    const cloudClientObj: CloudClient = {
        id: uuidv4(),
        socketId: socketId,
        key: key,
        ipAddress: ipAddress,
        datetimeConnected: datetimeConnected,
        inactive: false,
    };

	cloud_clients.push(cloudClientObj);

	UpdateSockets('cloud_clients');

	return cloudClientObj.id;
}

function DeleteCloudClients(key) {
	for (let i = cloud_clients.length - 1; i >= 0; i--) {
		if (cloud_clients[i].key === key) {
			if ((io.sockets as any).connected && (io.sockets as any).connected.includes(cloud_clients[i].socketId)) {
				(io.sockets as any).connected[cloud_clients[i].socketId].disconnect(true);
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
    const portObj: Port = {
        port,
        sourceId,
    };
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

function SendMessage(type: string, socketid: string | null, message: string) {
	io.to('messaging').emit('messaging', type, socketid, message);
}

function getConfigFilePath(): string {
	const configFolder = path.join(process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share"), "TallyArbiter");
	if (!fs.existsSync(configFolder)) {
		fs.mkdirSync(configFolder, { recursive: true });
	}
	const configName = "config.json";
	return path.join(configFolder, configName);
}

function getLogFilePath(): string {

	var today = new Date().toISOString().replace('T', ' ').replace(/\..+/, '').replace(/:/g, "-");

	const logFolder = path.join(process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences/' : process.env.HOME + "/.local/share/"), "TallyArbiter/logs");

	findRemoveSync(logFolder, {age: {seconds: 604800}, extensions: '.talog', limit: 100});

	if (!fs.existsSync(logFolder)) {
		fs.mkdirSync(logFolder, { recursive: true });
	}
	var logName = today + ".talog"
	return path.join(logFolder, logName);
}

function getTallyDataPath(): string {

	var today = new Date().toISOString().replace('T', ' ').replace(/\..+/, '').replace(/:/g, "-");

	const TallyDataFolder = path.join(process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences/' : process.env.HOME + "/.local/share/"), "TallyArbiter/TallyData");

	findRemoveSync(TallyDataFolder, {age: {seconds: 604800}, extensions: '.tadata', limit: 100});

	if (!fs.existsSync(TallyDataFolder)) {
		fs.mkdirSync(TallyDataFolder, { recursive: true });
	}
	var logName = today + ".tadata"
	return path.join(TallyDataFolder, logName);
}

function getErrorReportsList(): ErrorReportsListElement[] {
	try {
		const ErrorReportsFolder = path.join(process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences/' : process.env.HOME + "/.local/share/"), "TallyArbiter/ErrorReports");
		const ErrorReportsFiles = fs.readdirSync(ErrorReportsFolder);
		let errorReports = [];
		ErrorReportsFiles.forEach((file) => {
			let currentErrorReport = JSON.parse(fs.readFileSync(path.join(ErrorReportsFolder, file), "utf8"));
			let reportId = file.replace(/\.[^/.]+$/, "");
			errorReports.push({ id: reportId, datetime: currentErrorReport.datetime });
		});
		return errorReports;
	} catch (e) {
		return [];
	}
}

function getReadedErrorReports(): string[] {
	try {
		const readedErrorReportsFilePath = path.join(process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences/' : process.env.HOME + "/.local/share/"), "TallyArbiter/readedErrorReports.json");
		return JSON.parse(fs.readFileSync(readedErrorReportsFilePath, 'utf8'));
	} catch(e) {
		return [];
	}
}

function markErrorReportAsReaded(errorReportId: string): boolean {
	try {
		const readedErrorReportsFilePath = path.join(process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences/' : process.env.HOME + "/.local/share/"), "TallyArbiter/readedErrorReports.json");
		let readedErrorReportsList = getReadedErrorReports();
		readedErrorReportsList.push(errorReportId);
		fs.writeFileSync(readedErrorReportsFilePath, JSON.stringify(readedErrorReportsList));
		return true;
	} catch(e) {
		return false;
	}
}

function getUnreadedErrorReportsList(): ErrorReportsListElement[] {
	let errorReports = getErrorReportsList();
	let readedErrorReports = getReadedErrorReports();
	return errorReports.filter((report) => { return !readedErrorReports.includes(report.id); });
}

function getErrorReport(reportId: string): ErrorReport | false {
	try {
		if(!reportId.match(/^[a-zA-Z0-9]+$/i)) return false;
		const ErrorReportsFolder = path.join(process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences/' : process.env.HOME + "/.local/share/"), "TallyArbiter/ErrorReports");
		const ErrorReportFile = path.join(ErrorReportsFolder, reportId + ".json");
		return JSON.parse(fs.readFileSync(ErrorReportFile, "utf8"));
	} catch (e) {
		return false;
	}
}

function getErrorReportPath(id: string): string {

	const ErrorReportsFolder = path.join(process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences/' : process.env.HOME + "/.local/share/"), "TallyArbiter/ErrorReports");

	if (!fs.existsSync(ErrorReportsFolder)) {
		fs.mkdirSync(ErrorReportsFolder, { recursive: true });
	}
	var errorReportName = id + ".json"
	return path.join(ErrorReportsFolder, errorReportName);
}

function generateErrorReport(error: Error) {
	logger(`Caught exception: ${error}`, 'error');
	let id = uuidv4();
	let stacktrace = "No stacktrace captured.";
	if(error !== undefined){
		stacktrace = error.stack;
	}
	var errorReport = {
		"datetime": new Date(),
		"stacktrace": stacktrace,
		"logs": fs.readFileSync(logFilePath, 'utf8'),
		"config": getConfigRedacted()
	};
	fs.writeFileSync(getErrorReportPath(id), JSON.stringify(errorReport));
	io.emit("server_error", id);
}

function getNetworkInterfaces(): NetworkInterface[] { // Get all network interfaces on host device
	var interfaces = []
	const networkInterfaces = os.networkInterfaces()

	for (const networkInterface in networkInterfaces) {
		let numberOfAddresses = networkInterfaces[networkInterface].length
		let v4Addresses = []
		let iface = networkInterface.split(' ')[0]

		for (let i = 0; i < numberOfAddresses; i++) {
			if (networkInterfaces[networkInterface][i]['family'] === 'IPv4') {
				v4Addresses.push(networkInterfaces[networkInterface][i].address)
			}
		}
		const numV4s = v4Addresses.length
		for (let i = 0; i < numV4s; i++) {
			let aNum = numV4s > 1 ? `:${i}` : ''
			interfaces.push({
				label: `${networkInterface}${aNum}`,
				name: `${iface}${aNum}`,
				address: v4Addresses[i],
			})
		}
	}

	return interfaces
}

startUp();

export {
    Logs as logs,
    logFilePath,
    tallyDataFilePath,
    getConfigFilePath,
    getConfig,
    getConfigRedacted,
    generateErrorReport,
}
