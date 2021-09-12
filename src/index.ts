/* Tally Arbiter */

//Protocol, Network, Socket, Server libraries/variables
import net from 'net';
import dgram from 'dgram';
import fs from 'fs-extra';
import findPackageJson from "find-package-json";
import path from 'path';
import express from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import bodyParser from 'body-parser';
import http from 'http';
import socketio from 'socket.io';
import ioClient from 'socket.io-client';
import findRemoveSync from 'find-remove';
import { BehaviorSubject } from 'rxjs';

//TypeScript models
import { TallyInput } from './sources/_Source';
import { CloudClient } from "./_models/CloudClient";
import { FlashListenerClientResponse } from "./_models/FlashListenerClientResponse";
import { MessageListenerClientResponse } from "./_models/MessageListenerClientResponse";
import { ManageResponse } from './_models/ManageResponse';
import { LogItem } from "./_models/LogItem";
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

// Helpers
import { uuidv4 } from './_helpers/uuid';
import { logFilePath, Logs, serverLogger, tallyDataFile } from './_helpers/logger';
import { getNetworkInterfaces } from './_helpers/networkInterfaces';
import { loadClassesFromFolder } from './_helpers/fileLoder';
import { UsePort } from './_decorators/UsesPort.decorator';
import { secondsToHms } from './_helpers/time';
import { currentConfig, getConfigRedacted, readConfig, SaveConfig } from './_helpers/config';
import { deleteEveryErrorReport, generateErrorReport, getErrorReport, getErrorReportsList, getUnreadErrorReportsList, markErrorReportAsRead, markErrorReportsAsRead } from './_helpers/errorReports';
import { DeviceState } from './_models/DeviceState';
import { VMixEmulator } from './_modules/VMix';

const version = findPackageJson(__dirname).next()?.value?.version || "unknown";

//Rate limiter configurations
const maxWrongAttemptsByIPperDay = 100;
const maxConsecutiveFailsByUsernameAndIP = 10;
const maxPageRequestPerMinute = 100;
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
const limiterServeUI = new RateLimiterMemory({
	keyPrefix: 'UI_serve',
	points: maxPageRequestPerMinute,
	duration: 60, // Store number for 1 minute
	blockDuration: 60 * 10, // Block for 10 minutes
});

//Tally Arbiter variables
var uiDistPath = path.join(__dirname, 'ui-dist');
if (!fs.existsSync(uiDistPath)) {
    uiDistPath = path.join(__dirname, '..', 'ui-dist');
}

const listenPort: number = parseInt(process.env.PORT) || 4455;
const app = express();
const httpServer = new http.Server(app);

const io = new socketio.Server(httpServer, { allowEIO3: true });
const socketupdates_Settings: string[]  = ['sources', 'devices', 'device_sources', 'device_states', 'listener_clients', 'tsl_clients', 'cloud_destinations', 'cloud_keys', 'cloud_clients', 'PortsInUse', 'vmix_clients', "addresses"];
const socketupdates_Producer: string[]  = ['sources', 'devices', 'device_sources', 'device_states', 'listener_clients'];
const socketupdates_Companion: string[] = ['sources', 'devices', 'device_sources', 'device_states', 'listener_clients', 'tsl_clients', 'cloud_destinations'];

var listener_clients = []; //array of connected listener clients (web, python, relay, etc.)
let vMixEmulator: VMixEmulator;

export var tsl_clients: TSLClient[]							 = []; //array of TSL 3.1 clients that Tally Arbiter will send tally data to
var tsl_clients_interval: NodeJS.Timer | null			 = null;
var cloud_destinations: CloudDestination[]				 = []; //array of Tally Arbiter Cloud Destinations (host, port, key)
var cloud_destinations_sockets: CloudDestinationSocket[] = []; //array of actual socket connections
var cloud_keys: string[] 								 = []; //array of Tally Arbiter Cloud Sources (key only)
var cloud_clients: CloudClient[]						 = []; //array of Tally Arbiter Cloud Clients that have connected with a key

var TestMode = false; //if the system is in test mode or not
const SourceClients: Record<string, TallyInput> = {};

UsePort(listenPort.toString(), "reserved");
UsePort("80", "reserved");
UsePort("443", "reserved");

const addresses = new BehaviorSubject<Addresses>({});
addresses.subscribe(() => {
	UpdateSockets("addresses");
});

PortsInUse.subscribe(() => {
	UpdateSockets('PortsInUse');
})

var sources: Source[]						= []; // the configured tally sources
var devices: Device[] 						= []; // the configured tally devices
export var device_sources: DeviceSource[]	= []; // the configured tally device-source mappings
var device_actions: DeviceAction[]			= []; // the configured device output actions
var currentDeviceTallyData: DeviceTallyData = {}; // tally data (=bus array) per device id (linked busses taken into account)
var currentSourceTallyData: SourceTallyData = {}; // tally data (=bus array) per device source id


function startUp() {
	loadClassesFromFolder("actions");
	loadClassesFromFolder("sources");
	loadConfig();
	initialSetup();
	DeleteInactiveListenerClients();

	process.on('uncaughtException', (err: Error) => {
		if (!process.versions.hasOwnProperty('electron')) {
			generateAndSendErrorReport(err);
		}
	});
}


//sets up the REST API and GUI pages and starts the Express server that will listen for incoming requests
function initialSetup() {
	logger('Setting up the Main HTTP Server.', 'info-quiet');

	app.disable('x-powered-by');
	app.use(bodyParser.json({ type: 'application/json' }));

	//about the author, this program, etc.
	app.get('/', (req, res) => {
		limiterServeUI.consume(req.ip).then((data) => {
			res.sendFile('index.html', { root: uiDistPath });
		}).catch((data) => {
			res.status(429).send('Too Many Requests');
		});
	});

	//serve up any files in the ui-dist folder
	app.use(express.static(uiDistPath));

	app.use((req, res) => {
		res.status(404).send({error: true, url: req.originalUrl + ' not found.'});
	});

	logger('Main HTTP Server Complete.', 'info-quiet');

	logger('Starting socket.IO Setup.', 'info-quiet');

	io.sockets.on('connection', (socket) => {
		const ipAddr = socket.handshake.address;

		socket.on('login', (type: "settings" | "producer", username: string, password: string) => {
			if((type === "producer" && username == currentConfig.security.username_producer && password == currentConfig.security.password_producer)
			|| (type === "settings" && username == currentConfig.security.username_settings && password == currentConfig.security.password_settings)) {
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

		socket.on('externalAddress', () => {
			socket.emit('externalAddress', currentConfig.externalAddress);
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
			socket.emit('bus_options', currentConfig.bus_options);
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
			let canBeReassigned = obj.canBeReassigned ? obj.canBeReassigned : false;
			let canBeFlashed = obj.canBeFlashed ? obj.canBeFlashed : false;
			let supportsChat = obj.supportsChat ? obj.supportsChat : false;

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

			socket.emit('bus_options', currentConfig.bus_options);
			socket.emit('devices', devices);
			socket.emit('device_states', getDeviceStates(deviceId));

			if (oldDeviceId !== null) {
				//sends a reassign command to officially reassign the listener client to the new device ID since the first one was invalid
				ReassignListenerClient(clientId, oldDeviceId, deviceId);
			}
		});

		socket.on('device_states', (deviceId: string) => {
			socket.emit('device_states', getDeviceStates(deviceId));
		});

		socket.on('settings', () => {
			socket.join('settings');
			socket.join('messaging');
			socket.emit('initialdata', getSourceTypes(), getSourceTypeDataFields(), addresses.value, getOutputTypes(), getOutputTypeDataFields(), currentConfig.bus_options, getSources(), devices, device_sources, device_actions, getDeviceStates(), tsl_clients, cloud_destinations, cloud_keys, cloud_clients);
			socket.emit('listener_clients', listener_clients);
			socket.emit('logs', Logs);
			socket.emit('PortsInUse', PortsInUse.value);
			socket.emit('tslclients_1secupdate', currentConfig.tsl_clients_1secupdate);
		});

		socket.on('producer', () => {
			socket.join('producer');
			socket.join('messaging');
			socket.emit('sources', getSources());
			socket.emit('devices', devices);
			socket.emit('bus_options', currentConfig.bus_options);
			socket.emit('listener_clients', listener_clients);
			socket.emit('device_states', getDeviceStates());
		});

		socket.on('companion', () => {
			socket.join('companion');
			socket.emit('sources', getSources());
			socket.emit('devices', devices);
			socket.emit('bus_options', currentConfig.bus_options);
			socket.emit('device_sources', device_sources);
			socket.emit('device_states', getDeviceStates());
			socket.emit('listener_clients', listener_clients);
			socket.emit('tsl_clients', tsl_clients);
			socket.emit('cloud_destinations', cloud_destinations);
		});

		socket.on('flash', (clientId) => {
			FlashListenerClient(clientId);
		});

		socket.on('messaging_client', (clientId: {
			relayGroupId?: string;
			gpoGroupId?: string;
		}, type: string, socketid: string, message: string) => {
			MessageListenerClient(clientId, type, socketid, message);
		});

		socket.on('reassign', (clientId: string, oldDeviceId: string, deviceId: string) => {
			ReassignListenerClient(clientId, oldDeviceId, deviceId);
		});

		socket.on('listener_reassign', (oldDeviceId: string, deviceId: string) => {
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
			socket.emit('device_states', getDeviceStates());
		});

		socket.on('listener_reassign_relay', (relayGroupId, oldDeviceId, deviceId) => {
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

		socket.on('listener_reassign_gpo', (gpoGroupId, oldDeviceId, deviceId) => {
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

		socket.on('listener_reassign_object', (reassignObj) => {
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
			socket.emit('device_states', getDeviceStates());
		});

		socket.on('listener_delete', (clientId) => { // emitted by the Settings page when an inactive client is being removed manually
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

		socket.on('cloud_destination_reconnect', (cloudDestinationId) => {
			StartCloudDestination(cloudDestinationId);
		});

		socket.on('cloud_destination_disconnect', (cloudDestinationId) => {
			StopCloudDestination(cloudDestinationId);
		});

		socket.on('cloud_client', (key) => {
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

		socket.on('cloud_sources', (key, data) => {
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

		socket.on('cloud_devices', (key, data) => {
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

		socket.on('cloud_device_sources', (key, data) => {
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

		socket.on('cloud_listeners', (key: string, data: CloudListenerSocketData[]) => {
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

		socket.on('cloud_data', (key: string, sourceId: string, tallyObj: SourceTallyData) => {
			if (cloud_keys.includes(key)) {
				processSourceTallyData(sourceId, tallyObj);
			}
			else {
				socket.emit('invalidkey');
				socket.disconnect();
			}
		});

		socket.on('manage', (arbiterObj: Manage) => {
			const response = TallyArbiter_Manage(arbiterObj);
			io.to('settings').emit('manage_response', response);
		});

		socket.on('reconnect_source', (sourceId: string) => {
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

		socket.on('testmode', (value: boolean) => {
			EnableTestMode(value);
		});

		socket.on('tslclients_1secupdate', (value: boolean) => {
			currentConfig.tsl_clients_1secupdate = value;
			SaveConfig();
			TSLClients_1SecUpdate(value);
		})

		socket.on('messaging', (type: string, message: string) => {
			SendMessage(type, socket.id, message);
		});

		socket.on('get_error_reports', () =>  {
			socket.emit('error_reports', getErrorReportsList());
		});

		socket.on('get_unread_error_reports', () =>  {
			socket.emit('unread_error_reports', getUnreadErrorReportsList());
		});

		socket.on('get_error_report', (errorReportId: string) => {
			markErrorReportAsRead(errorReportId);
			socket.emit('error_report', getErrorReport(errorReportId));
		});

		socket.on('mark_error_reports_as_read', () => {
			markErrorReportsAsRead();
		});

		socket.on('delete_every_error_report', () => {
			deleteEveryErrorReport();
		});

		socket.on('disconnect', () =>  { // emitted when any socket.io client disconnects from the server
			DeactivateListenerClient(socket.id);
			CheckCloudClients(socket.id);
		});
	});

	logger('Socket.IO Setup Complete.', 'info-quiet');

	logger('Starting VMix Emulation Service.', 'info-quiet');

	vMixEmulator = new VMixEmulator();
	vMixEmulator.on("chatMessage", (type, socketId, message) => SendMessage(type, socketId, message));
	vMixEmulator.on("updateClients", () => {
        UpdateSockets('vmix_clients');
        UpdateCloud('vmix_clients');
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
		logger(`Initiating ${cloud_destinations.length} Cloud Destination Connections.`, 'info');

		for (let i = 0; i < cloud_destinations.length; i++) {
			logger(`Cloud Destination: ${cloud_destinations[i].host}:${cloud_destinations[i].port}`, 'info-quiet');
			cloud_destinations[i].connected = false;
			StartCloudDestination(cloud_destinations[i].id);
		}

		logger(`Finished Cloud Destinations.`, 'info');
	}

	logger('Starting HTTP Server.', 'info-quiet');

	httpServer.listen(listenPort, () => { // start up http server
		logger(`Tally Arbiter running on port ${listenPort}`, 'info');
	});
}

function getSources(): Source[] {
	return sources.map((s) => {
		s.connected = SourceClients[s.id]?.connected?.value || false;
		return s;
	});
}

function getDeviceStates(deviceId?: string): DeviceState[] {
	return devices.filter((d) => deviceId ? d.id == deviceId : true).flatMap((d) => currentConfig.bus_options.map((b) => {
		const deviceSources = device_sources.filter((s) => s.deviceId == d.id);
		return {
			busId: b.id,
			deviceId: d.id,
			sources: deviceSources.filter(
				(s) => Object.entries(SourceClients[s.sourceId]?.tally?.value || [])
				.filter(([address, busses]) => address == s.address)
					.findIndex(([address, busses]) => busses.includes(b.type)) !== -1).map((s) => s.id),
		}
	}));
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
	for (const bus of currentConfig.bus_options) {
		if ((device.linkedBusses || []).includes(bus.id)) {
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
	UpdateSockets("device_states");
	UpdateListenerClients(deviceId);
}

export function logger(log, type: "info-quiet" | "info" | "error" | "console_action" = "info-quiet"): void { //logs the item to the console, to the log array, and sends the log item to the settings page
	serverLogger.log({
		level: type,
		message: log
	});

	const logObj: LogItem = {} as LogItem;
	logObj.datetime = new Date().toISOString();
	logObj.log = log;
	logObj.type = type;
	Logs.push(logObj);
	io.to('settings').emit('log_item', logObj);
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
		readConfig();

		sources = currentConfig.sources;
		logger('Tally Arbiter Sources loaded.', 'info');
		logger(`${sources.length} Sources configured.`, 'info');


		devices = currentConfig.devices;
		logger('Tally Arbiter Devices loaded.', 'info');
		logger(`${devices.length} Devices configured.`, 'info');
	
		device_sources = currentConfig.device_sources;
		logger('Tally Arbiter Device Sources loaded.', 'info');
		logger(`${device_sources.length} Device Sources configured.`, 'info');

		device_actions = currentConfig.device_actions;
		logger('Tally Arbiter Device Actions loaded.', 'info');
		logger(`${device_actions.length} Device Sources configured.`, 'info');

		tsl_clients = currentConfig.tsl_clients.map((t) => ({...t, connected: false}));
		logger('Tally Arbiter TSL Clients loaded.', 'info');
		logger(`${device_actions.length} Device Sources configured.`, 'info');

		if (currentConfig.tsl_clients_1secupdate) {
			currentConfig.tsl_clients_1secupdate = true;
			TSLClients_1SecUpdate(true);
		}
		else {
			currentConfig.tsl_clients_1secupdate = false;
			TSLClients_1SecUpdate(false);
		}

		if (currentConfig.cloud_destinations) {
			cloud_destinations = currentConfig.cloud_destinations;
			logger('Tally Arbiter Cloud Destinations loaded.', 'info');
		}
		else {
			cloud_destinations = [];
			logger('Tally Arbiter Cloud Destinations could not be loaded.', 'error');
		}

		if (currentConfig.cloud_keys) {
			cloud_keys = currentConfig.cloud_keys;
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
	logger(`Source: ${source.name} Creating ${TallyInputs[source.sourceTypeId].label} connection.`, 'info-quiet');
	const sourceClient = new TallyInputs[source.sourceTypeId].cls(source) as TallyInput;
	sourceClient.connected.subscribe((connected) => {
		UpdateSockets('sources');
		UpdateCloud('sources');
		if (connected) {
            logger(`Source: ${source.name} ${TallyInputs[source.sourceTypeId].label} Connection Opened.`, 'info');
		} else {
			logger(`Source: ${source.name} Closed ${TallyInputs[source.sourceTypeId].label} connection.`, 'info-quiet');
		}
	});
	sourceClient.tally.subscribe((tallyDataWithAddresses: AddressTallyData) => {
		const tallyData: SourceTallyData = {};
		for (const [sourceAddress, busses] of Object.entries(tallyDataWithAddresses)) {
			let device_source = device_sources.find((s) => s.sourceId == source.id && s.address == sourceAddress);
			if(device_source) {
				tallyData[device_source.id] = busses;
			}
		}
		processSourceTallyData(source.id, tallyData);
	});
	sourceClient.addresses.subscribe((sourceAddresses) => {
		addresses.next({
			...addresses.value,
			[source.id]: sourceAddresses,
		});
	});
	sourceClient.on("renameAddress", (address: string, newAddress: string) => {
		for (const deviceSource of device_sources.filter((d) => d.rename && d.sourceId == source.id && d.address == address)) {
			deviceSource.address = newAddress;
		}
		UpdateSockets("device_sources");
		SaveConfig();
	});
	SourceClients[source.id] = sourceClient;
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
			io.emit('bus_options', currentConfig.bus_options); //emit the new bus options array to everyone
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
	const source = sources.find((s) => s.id == sourceId);
	logger(`Source: ${source.name} Closing ${TallyInputs[source.sourceTypeId].label} connection.`, 'info-quiet');
	SourceClients[sourceId].exit();
}

function StartTSLClientConnection(tslClientId) {
	for (let i = 0; i < tsl_clients.length; i++) {
		if (tsl_clients[i].id === tslClientId) {
			switch(tsl_clients[i].transport) {
				case 'udp':
					logger(`TSL Client: ${tslClientId}  Initiating TSL Client UDP Socket.`, 'info-quiet');
					tsl_clients[i].socket = dgram.createSocket('udp4');
					tsl_clients[i].socket.on('error', (error) => {
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
					tsl_clients[i].socket.on('error', (error) => {
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
					tsl_clients[i].socket.on('close', () => {
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

			cloud_destinations_sockets[i].socket.on('invalidkey', () => {
				cloud_destinations_sockets[i].error = true;
				logger(`An error occurred with the connection to ${cloud_destinations_sockets[i].host}:${cloud_destinations_sockets[i].port} : The specified key could not be found on the host: ${cloud_destinations_sockets[i].key}`, 'error');
				SetCloudDestinationStatus(cloud_destinations_sockets[i].id, 'invalid-key');
			});

			cloud_destinations_sockets[i].socket.on('flash', (listenerClientId) => {
				FlashListenerClient(listenerClientId);
			});

			cloud_destinations_sockets[i].socket.on('messaging_client', (listenerClientId, type, socketid, message) => {
				MessageListenerClient(listenerClientId, type, socketid, message);
			});

			cloud_destinations_sockets[i].socket.on('error', (error) => {
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

function UpdateCloud(dataType: 'sources' | 'devices' | 'device_sources' | 'device_states' | 'listener_clients' | 'vmix_clients' | 'tsl_clients' | 'cloud_destinations' | 'cloud_clients' | "PortsInUse") {
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

type SocketUpdateDataType = 'sources' | 'devices' | 'device_sources' | 'device_states' | 'listener_clients' | 'vmix_clients' | 'tsl_clients' | 'cloud_destinations' | 'cloud_clients' | "PortsInUse" | "addresses";

function UpdateSockets(dataType: SocketUpdateDataType) {
	const data: Record<SocketUpdateDataType, () => any> = {
		PortsInUse: () => PortsInUse.value,
		addresses: () => addresses.value,
		sources: () => getSources(),
		devices: () => devices,
		device_sources: () => device_sources,
		device_states: () => getDeviceStates(), 
		listener_clients: () => listener_clients, 
		vmix_clients: () => vMixEmulator.vmix_client_data, 
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

	for (let i = 0; i < currentConfig.bus_options.length; i++) {
		switch(currentConfig.bus_options[i].type) {
			case 'preview':
				busId_preview = currentConfig.bus_options[i].id;
				break;
			case 'program':
				busId_program = currentConfig.bus_options[i].id;
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

	for (let i = 0; i < vMixEmulator.vmix_clients.length; i++) {
		vMixEmulator.vmix_clients[i].write(vmixTallyString);
	}
}

function TallyArbiter_Add_Source(obj: Manage): ManageResponse {
	let sourceObj = obj.source as Source;
	sourceObj.id = uuidv4();
	sources.push(sourceObj);

	UpdateCloud('sources');

	logger(`Source Added: ${sourceObj.name}`, 'info');

	initializeSource(sourceObj);

	return {result: 'source-added-successfully'};
}

function TallyArbiter_Edit_Source(obj: Manage): ManageResponse {
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

function TallyArbiter_Delete_Source(obj: Manage): ManageResponse {
	let sourceId = obj.sourceId;
	let sourceName = null;

	for (let i = 0; i < sources.length; i++) {
		if (sources[i].id === sourceId) {
			sourceName = sources[i].name;
			StopConnection(sourceId);
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

	UpdateSockets('device_states');

	logger(`Source Deleted: ${sourceName}`, 'info');

	return {result: 'source-deleted-successfully'};
}

function TallyArbiter_Add_Device(obj: Manage): ManageResponse {
	let deviceObj = obj.device;
	deviceObj.id = uuidv4();
	devices.push(deviceObj);

	UpdateCloud('devices');

	UpdateDeviceState(deviceObj.id);

	SendTSLClientData(deviceObj.id);

	logger(`Device Added: ${deviceObj.name}`, 'info');

	return {result: 'device-added-successfully'};
}

function TallyArbiter_Edit_Device(obj: Manage): ManageResponse {
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

function TallyArbiter_Delete_Device(obj: Manage): ManageResponse {
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

function TallyArbiter_Add_Device_Source(obj: Manage): ManageResponse {
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

function TallyArbiter_Edit_Device_Source(obj: Manage): ManageResponse {
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

function TallyArbiter_Delete_Device_Source(obj: Manage): ManageResponse {
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

function TallyArbiter_Add_Device_Action(obj: Manage): ManageResponse {
	let deviceActionObj = obj.device_action;
	let deviceId = deviceActionObj.deviceId;
	deviceActionObj.id = uuidv4();
	device_actions.push(deviceActionObj);

	let deviceName = GetDeviceByDeviceId(deviceActionObj.deviceId).name;

	logger(`Device Action Added: ${deviceName}`, 'info');

	return {result: 'device-action-added-successfully', deviceId: deviceId};
}

function TallyArbiter_Edit_Device_Action(obj: Manage): ManageResponse {
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

function TallyArbiter_Delete_Device_Action(obj: Manage): ManageResponse {
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

function TallyArbiter_Add_TSL_Client(obj: Manage): ManageResponse {
	let tslClientObj = obj.tslClient;
	tslClientObj.id = uuidv4();
	tsl_clients.push(tslClientObj);

	logger(`TSL Client Added: ${tslClientObj.ip}:${tslClientObj.port} (${tslClientObj.transport})`, 'info');

	StartTSLClientConnection(tslClientObj.id);

	return {result: 'tsl-client-added-successfully'};
}

function TallyArbiter_Edit_TSL_Client(obj: Manage): ManageResponse {
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

function TallyArbiter_Delete_TSL_Client(obj: Manage): ManageResponse {
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

function TallyArbiter_Add_Bus_Option(obj: Manage): ManageResponse {
	let busOptionObj = obj.busOption;
	busOptionObj.id = uuidv4();
	currentConfig.bus_options.push(busOptionObj);

	logger(`Bus Option Added: ${busOptionObj.label}:${busOptionObj.type} (${busOptionObj.color})`, 'info');

	return {result: 'bus-option-added-successfully'};
}

function TallyArbiter_Edit_Bus_Option(obj: Manage): ManageResponse {
	let busOptionObj = obj.busOption;

	for (let i = 0; i < currentConfig.bus_options.length; i++) {
		if (currentConfig.bus_options[i].id === busOptionObj.id) {
			currentConfig.bus_options[i].label = busOptionObj.label;
			currentConfig.bus_options[i].type = busOptionObj.type;
			currentConfig.bus_options[i].color = busOptionObj.color;
			break;
		}
	}

	logger(`Bus Option Edited: ${busOptionObj.label}:${busOptionObj.type} (${busOptionObj.color})`, 'info');

	return {result: 'bus-option-edited-successfully'};
}

function TallyArbiter_Delete_Bus_Option(obj: Manage): ManageResponse {
	let busOptionObj = GetBusByBusId(obj.busOptionId);
	let busOptionId = obj.busOptionId;

	for (let i = 0; i < currentConfig.bus_options.length; i++) {
		if (currentConfig.bus_options[i].id === busOptionId) {
			currentConfig.bus_options.splice(i, 1);
			break;
		}
	}

	logger(`Bus Option Deleted: ${busOptionObj.label}:${busOptionObj.type} (${busOptionObj.color})`, 'info');

	return {result: 'bus-option-deleted-successfully'};
}

function TallyArbiter_Add_Cloud_Destination(obj: Manage): ManageResponse {
	let cloudObj = obj.cloudDestination;
	cloudObj.id = uuidv4();
	cloud_destinations.push(cloudObj);

	logger(`Cloud Destination Added: ${cloudObj.host}:${cloudObj.port}`, 'info');

	StartCloudDestination(cloudObj.id);

	return {result: 'cloud-destination-added-successfully'};
}

function TallyArbiter_Edit_Cloud_Destination(obj: Manage): ManageResponse {
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

function TallyArbiter_Delete_Cloud_Destination(obj: Manage): ManageResponse {
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

function TallyArbiter_Add_Cloud_Key(obj: Manage): ManageResponse {
	cloud_keys.push(obj.key);

	logger(`Cloud Key Added: ${obj.key}`, 'info');

	return {result: 'cloud-key-added-successfully'};
}

function TallyArbiter_Delete_Cloud_Key(obj: Manage): ManageResponse {
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

function TallyArbiter_Remove_Cloud_Client(obj: Manage): ManageResponse {
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

function GetBusByBusId(busId: string): BusOption {
	//gets the Bus object by id
	return currentConfig.bus_options.find( ({ id }) => id === busId);
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
		io.to(`device-${deviceId}`).emit('device_states', getDeviceStates(deviceId));
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

function SendMessage(type: string, socketid: string | null, message: string) {
	io.to('messaging').emit('messaging', type, socketid, message);
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


function generateAndSendErrorReport(error: Error) {
	let id = generateErrorReport(error);
	io.emit("server_error", id);
}

startUp();

export {
    logFilePath,
    getConfigRedacted,
    generateAndSendErrorReport,
}

