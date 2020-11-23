var socket = null;
var Version = null;
var listener_clients = [];
var Logs = [];
var PortsInUse = [];
var TallyData = [];
var source_types = [];
var source_types_datafields = [];
var output_types = [];
var output_types_datafields = [];
var bus_options = [];
var sources = [];
var devices = [];
var device_sources = [];
var device_actions = [];
var tsl_clients = [];
var cloud_destinations = [];
var cloud_keys = [];
var cloud_clients = [];
var device_states = [];
var selectedDeviceId = null;
var selectedTSLClientId = null;
var selectedCloudId = null;
var TallyAddresses_ATEM = [
	{
	address: 0
	, label: "Black"
	}
	, {
	address: 1
	, label: "Input 1"
	}
	, {
	address: 2
	, label: "Input 2"
	}
	, {
	address: 3
	, label: "Input 3"
	}
	, {
	address: 4
	, label: "Input 4"
	}
	, {
	address: 5
	, label: "Input 5"
	}
	, {
	address: 6
	, label: "Input 6"
	}
	, {
	address: 7
	, label: "Input 7"
	}
	, {
	address: 8
	, label: "Input 8"
	}
	, {
	address: 9
	, label: "Input 9"
	}
	, {
	address: 10
	, label: "Input 10"
	}
	, {
	address: 11
	, label: "Input 11"
	}
	, {
	address: 12
	, label: "Input 12"
	}
	, {
	address: 13
	, label: "Input 13"
	}
	, {
	address: 14
	, label: "Input 14"
	}
	, {
	address: 15
	, label: "Input 15"
	}
	, {
	address: 16
	, label: "Input 16"
	}
	, {
	address: 17
	, label: "Input 17"
	}
	, {
	address: 18
	, label: "Input 18"
	}
	, {
	address: 19
	, label: "Input 19"
	}
	, {
	address: 20
	, label: "Input 20"
	}
	, {
	address: 1000
	, label: "Color Bars"
	}
	, {
	address: 2001
	, label: "Color 1"
	}
	, {
	address: 2002
	, label: "Color 2"
	}
	, {
	address: 3010
	, label: "Media Player 1"
	}
	, {
	address: 3011
	, label: "Media Player 1 Key"
	}
	, {
	address: 3020
	, label: "Media Player 2"
	}
	, {
	address: 3021
	, label: "Media Player 2 Key"
	}
	, {
	address: 4010
	, label: "Key 1 Mask"
	}
	, {
	address: 4020
	, label: "Key 2 Mask"
	}
	, {
	address: 4030
	, label: "Key 3 Mask"
	}
	, {
	address: 4040
	, label: "Key 4 Mask"
	}
	, {
	address: 5010
	, label: "DSK 1 Mask"
	}
	, {
	address: 5020
	, label: "DSK 2 Mask"
	}
	, {
	address: 6000
	, label: "Super Source"
	}
	, {
	address: 7001
	, label: "Clean Feed 1"
	}
	, {
	address: 7002
	, label: "Clean Feed 2"
	}
	, {
	address: 8001
	, label: "Auxilary 1"
	}
	, {
	address: 8002
	, label: "Auxilary 2"
	}
	, {
	address: 8003
	, label: "Auxilary 3"
	}
	, {
	address: 8004
	, label: "Auxilary 4"
	}
	, {
	address: 8005
	, label: "Auxilary 5"
	}
	, {
	address: 8006
	, label: "Auxilary 6"
	}
	, {
	address: 10010
	, label: "ME 1 Prog"
	, type: "Program"
	}
	, {
	address: 10011
	, label: "ME 1 Prev"
	, type: "Preview"
	}
	, {
	address: 10020
	, label: "ME 2 Prog"
	, type: "Program"
	}
	, {
	address: 10021
	, label: "ME 2 Prev"
	, type: "Preview"
	}
];

window.onload = loadSettings;

function loadSettings() {
	//gets the latest data from the server
	loadSocket();
}

function loadSocket() {
	socket = io.connect();
	socket.on('connect', function () {
		// Connected, let's sign-up for to receive messages for this room
		socket.emit('version');
		socket.emit('settings');
	});
	socket.on('version', function (version) {
		Version = version;
		loadVersion();
	})
	socket.on('PortsInUse', function (ports) {
		// the ports currently reserved or in use
		PortsInUse = ports;
	});
	socket.on('initialdata', function (sourceTypes, sourceTypesDataFields, outputTypes, outputTypesDataFields, busOptions, sourcesData, devicesData, deviceSources, deviceActions, deviceStates, tslClients, cloudDestinations, cloudKeys, cloudClients) {
		source_types = sourceTypes;
		source_types_datafields = sourceTypesDataFields;
		output_types = outputTypes;
		output_types_datafields = outputTypesDataFields;
		bus_options = busOptions;
		sources = sourcesData;
		devices = devicesData;
		device_sources = deviceSources;
		device_actions = deviceActions;
		device_states = deviceStates;
		tsl_clients = tslClients;
		cloud_destinations = cloudDestinations;
		cloud_keys = cloudKeys;
		cloud_clients = cloudClients;

		loadSources();
		loadDevices();
		loadTSLClients();
		loadCloudDestinations();
		loadCloudKeys();
		loadCloudClients();
	});

	socket.on('device_states', function (data) {
		//process the data received and determine if it's in preview or program and color the screen accordingly
		device_states = data;
		loadDeviceStates();
	});
	socket.on('sources', function (data) {
		sources = data;
		loadSources();
	});
	socket.on('devices', function (data) {
		devices = data;
		loadDevices();
	});
	socket.on('device_sources', function (data) {
		device_sources = data;
		loadDevices();
	});

	socket.on('device_actions', function (data) {
		device_actions = data;
		loadDevices();
	});

	socket.on('listener_clients', function (data) {
		listener_clients = data;
		loadDevices();
		loadListeners();
	});
	socket.on('tsl_clients', function (data) {
		tsl_clients = data;
		loadTSLClients();
	});
	socket.on('cloud_destinations', function (data) {
		cloud_destinations = data;
		loadCloudDestinations();
	});
	socket.on('cloud_keys', function (data) {
		cloud_keys = data;
		loadCloudKeys();
	});
	socket.on('cloud_clients', function (data) {
		cloud_clients = data;
		loadCloudClients();
	});
	socket.on('logs', function (logs) {
		Logs = logs;
		loadLogs();
	});
	socket.on('log_item', function (logObj) {
		Logs.push(logObj);
		AddLog(logObj);
	});
	socket.on('tally_data', function (sourceId, tallyObj) {
		AddTallyData(sourceId, tallyObj);
	});
	socket.on('manage_response', function(response) {
		let responseText = '';
		console.log(response);
		switch (response.result) {
			case 'source-added-successfully':
			case 'source-edited-successfully':
			case 'source-deleted-successfully':
				$("#addSource").modal('hide');
				$('#divContainer_SourceFields')[0].style.display = 'none';
				socket.emit('sources');
				socket.emit('devices');
				$('#divContainer_DeviceSources')[0].style.display = 'none';
				$('#divContainer_DeviceSourceFields')[0].style.display = 'none';
				loadSources();
				loadDevices();
				break;
			case 'device-added-successfully':
			case 'device-edited-successfully':
			case 'device-deleted-successfully':
				$("#addDevice").modal('hide');
				$('#divContainer_DeviceFields')[0].style.display = 'none';
				socket.emit('devices');
				socket.emit('device_sources');
				socket.emit('device_actions');
				socket.emit('device_states');
				socket.emit('listener_clients');
				loadDevices();
				loadListeners();
				$('#divContainer_DeviceFields')[0].style.display = 'none';
				$('#divContainer_DeviceSources')[0].style.display = 'none';
				$('#divContainer_DeviceSourceFields')[0].style.display = 'none';
				$('#divContainer_DeviceActions')[0].style.display = 'none';
				$('#divContainer_DeviceActionFields')[0].style.display = 'none';
				break;
			case 'device-source-added-successfully':
			case 'device-source-edited-successfully':
			case 'device-source-deleted-successfully':
				$('#divContainer_DeviceSourceFields')[0].style.display = 'none';
				socket.emit('device_sources');
				$("#modalDeviceSources").modal('hide');
				loadDevices();
				//Edit_Device_Sources(response.deviceId);
				$('#divContainer_DeviceFields')[0].style.display = 'none';
				$('#divContainer_DeviceSources')[0].style.display = 'block';
				$('#divContainer_DeviceSourceFields')[0].style.display = 'none';
				$('#divContainer_DeviceActions')[0].style.display = 'none';
				$('#divContainer_DeviceActionFields')[0].style.display = 'none';
				break;
			case 'device-action-added-successfully':
			case 'device-action-edited-successfully':
			case 'device-action-deleted-successfully':
				$('#divContainer_DeviceActionFields')[0].style.display = 'none';
				socket.emit('devices');
				socket.emit('device_actions');
				$("#modalDeviceActions").modal('hide');
				loadDevices();
				//Edit_Device_Actions(response.deviceId);
				$('#divContainer_DeviceFields')[0].style.display = 'none';
				$('#divContainer_DeviceSources')[0].style.display = 'none';
				$('#divContainer_DeviceSourceFields')[0].style.display = 'none';
				$('#divContainer_DeviceActions')[0].style.display = 'block';
				$('#divContainer_DeviceActionFields')[0].style.display = 'none';
				break;
			case 'tsl-client-added-successfully':
			case 'tsl-client-edited-successfully':
			case 'tsl-client-deleted-successfully':
				$("#modalTSLClient").modal('hide');
				$('#divContainer_TSLClientFields')[0].style.display = 'none';
				socket.emit('tsl_clients');
				loadTSLClients();
				break;
			case 'cloud-destination-added-successfully':
			case 'cloud-destination-edited-successfully':
			case 'cloud-destination-deleted-successfully':
				$("#modalCloudDestination").modal('hide');
				$('#divContainer_CloudDestinationFields')[0].style.display = 'none';
				socket.emit('cloud_destinations');
				loadCloudDestinations();
				break;
			case 'cloud-key-added-successfully':
			case 'cloud-key-deleted-successfully':
				$("#modalCloudKey").modal('hide');
				$('#divContainer_CloudKeyFields')[0].style.display = 'none';
				socket.emit('cloud_keys');
				loadCloudKeys();
				break;
			case 'cloud-client-removed-successfully':
				$("#modalCloudClient").modal('hide');
				socket.emit('cloud_clients');
				loadCloudClients();
				break;
			case 'error':
				responseText = 'Unexpected Error Occurred: ' + response.error;
				break;
			default:
				responseText = response.result;
				break;
		}
	});
}

function loadVersion() {
	let divVersion = $('#version')[0];
	divVersion.innerHTML = `Version ${Version}`;
}

function loadSources() {
	let divSources = $('#divSources')[0];
	divSources.innerHTML = '';
	let tableSources = document.createElement('table');
	tableSources.className = 'table';
	let trHeader = document.createElement('tr');
	let tdHeaderSourceName = document.createElement('td');
	tdHeaderSourceName.innerHTML = '<b>Name</b>';
	trHeader.appendChild(tdHeaderSourceName);
	let tdHeaderSourceCloud = document.createElement('td');
	tdHeaderSourceCloud.innerHTML = '&nbsp;';
	trHeader.appendChild(tdHeaderSourceCloud);
	let tdHeaderSourceType = document.createElement('td');
	tdHeaderSourceType.innerHTML = '<b>Type</b>';
	trHeader.appendChild(tdHeaderSourceType);
	let tdHeaderSourceEdit = document.createElement('td');
	tdHeaderSourceEdit.innerHTML = '&nbsp;';
	trHeader.appendChild(tdHeaderSourceEdit);
	tableSources.appendChild(trHeader);
	for (let i = 0; i < sources.length; i++) {
		let trSourceItem = document.createElement('tr');
		trSourceItem.className = ((sources[i].connected === true) ? 'source_status_connected' : 'source_status_disconnected');
		let tdSourceName = document.createElement('td');
		tdSourceName.innerHTML = sources[i].name;
		if (sources[i].enabled === false) {
			tdSourceName.className = 'disabled';
		}
		trSourceItem.appendChild(tdSourceName);
		let tdSourceCloud = document.createElement('td');
		if (sources[i].cloudConnection) {
			let imgCloud = document.createElement('img');
			imgCloud.src = 'lib/img/cloud.png';
			imgCloud.width = '20';
			tdSourceCloud.appendChild(imgCloud);
		}
		trSourceItem.appendChild(tdSourceCloud);
		let tdSourceType = document.createElement('td');
		tdSourceType.innerHTML = GetSourceTypeById(sources[i].sourceTypeId).label;
		if (sources[i].enabled === false) {
			tdSourceType.className = 'disabled';
		}
		trSourceItem.appendChild(tdSourceType);
		if (!sources[i].cloudConnection) {
			let tdSourceEdit = document.createElement('td');
			let btnEditSource = document.createElement('button');
			btnEditSource.className = 'btn btn-dark mr-1';
			btnEditSource.innerHTML = 'Edit';
			btnEditSource.setAttribute('onclick', 'Edit_Source(\'' + sources[i].id + '\');');
			tdSourceEdit.appendChild(btnEditSource);
			let btnDeleteSource = document.createElement('button');
			btnDeleteSource.className = 'btn btn-dark mr-1';
			btnDeleteSource.innerHTML = 'Delete';
			btnDeleteSource.setAttribute('onclick', 'Delete_Source(\'' + sources[i].id + '\');');
			tdSourceEdit.appendChild(btnDeleteSource);
			trSourceItem.appendChild(tdSourceEdit);
		}
		tableSources.appendChild(trSourceItem);
	}
	if (sources.length > 0) {
		divSources.appendChild(tableSources);
	}
	else {
		let spanNoSources = document.createElement('span');
		spanNoSources.innerHTML = '(no sources configured)';
		divSources.appendChild(spanNoSources);
	}
}

function loadDevices() {
	let divDevices = $('#divDevices')[0];
	divDevices.innerHTML = '';
	let tableDevices = document.createElement('table');
	tableDevices.className = 'table';
	let trHeader = document.createElement('tr');
	let tdHeaderDeviceTallyStatus_PVW = document.createElement('td');
	tdHeaderDeviceTallyStatus_PVW.innerHTML = 'PVW';
	trHeader.appendChild(tdHeaderDeviceTallyStatus_PVW);
	let tdHeaderDeviceTallyStatus_PGM = document.createElement('td');
	tdHeaderDeviceTallyStatus_PGM.innerHTML = 'PGM';
	trHeader.appendChild(tdHeaderDeviceTallyStatus_PGM);
	let tdHeaderDeviceName = document.createElement('td');
	tdHeaderDeviceName.innerHTML = '<b>Name</b>';
	trHeader.appendChild(tdHeaderDeviceName);
	let tdHeaderDeviceCloud = document.createElement('td');
	tdHeaderDeviceCloud.innerHTML = '&nbsp;';
	trHeader.appendChild(tdHeaderDeviceCloud);
	let tdHeaderDeviceDescription = document.createElement('td');
	tdHeaderDeviceDescription.innerHTML = '<b>Description</b>';
	trHeader.appendChild(tdHeaderDeviceDescription);
	let tdHeaderDeviceEdit = document.createElement('td');
	tdHeaderDeviceEdit.innerHTML = '&nbsp;';
	trHeader.appendChild(tdHeaderDeviceEdit);
	tableDevices.appendChild(trHeader);
	for (let i = 0; i < devices.length; i++) {
		let trDeviceItem = document.createElement('tr');
		let mode_preview = false;
		let mode_program = false;
		let sources_pvw = [];
		let sources_pgm = [];
		for (let j = 0; j < device_states.length; j++) {
			if ((device_states[j].deviceId === devices[i].id) && (getBusById(device_states[j].busId).type === 'preview')) {
				if (device_states[j].sources.length > 0) {
					mode_preview = true;
					sources_pvw = device_states[j].sources;
				}
				else {
					mode_preview = false;
				}
			}
			else if ((device_states[j].deviceId === devices[i].id) && (getBusById(device_states[j].busId).type === 'program')) {
				if (device_states[j].sources.length > 0) {
					mode_program = true;
					sources_pgm = device_states[j].sources;
				}
				else {
					mode_program = false;
				}
			}
		}
		let tdDeviceTallyStatus_PVW = document.createElement('td');
		tdDeviceTallyStatus_PVW.id = 'td_tallyPVW_' + devices[i].id;
		tdDeviceTallyStatus_PVW.className = 'device_state_tally';
		if (mode_preview) {
			tdDeviceTallyStatus_PVW.className = 'device_state_tally_preview';
			if (sources_pvw.length > 0) {
			let spanSourcesText = document.createElement('span');
			spanSourcesText.className = 'sources_pvw_tooltip';
			let sourceText = '';
			for (let j = 0; j < sources_pvw.length; j++) {
				sourceText += GetSourceById(sources_pvw[j].sourceId).name;
				if ((j > 0) && (j < sources_pvw.length - 1)) {
				sourceText += ', ';
				}
			}
			spanSourcesText.innerHTML = sourceText;
			tdDeviceTallyStatus_PVW.innerHTML = '';
			tdDeviceTallyStatus_PVW.appendChild(spanSourcesText);
			}
		}
		trDeviceItem.appendChild(tdDeviceTallyStatus_PVW);
		let tdDeviceTallyStatus_PGM = document.createElement('td');
		tdDeviceTallyStatus_PGM.id = 'td_tallyPGM_' + devices[i].id;
		tdDeviceTallyStatus_PGM.className = 'device_state_tally';
		if (mode_program) {
			tdDeviceTallyStatus_PGM.className = 'device_state_tally_program';
			if (sources_pgm.length > 0) {
			let spanSourcesText = document.createElement('span');
			spanSourcesText.className = 'sources_pgm_tooltip';
			let sourceText = '';
			for (let j = 0; j < sources_pgm.length; j++) {
				sourceText += GetSourceById(sources_pgm[j].sourceId).name;
				if ((j > 0) && (j < sources_pgm.length - 1)) {
				sourceText += ', ';
				}
			}
			spanSourcesText.innerHTML = sourceText;
			tdDeviceTallyStatus_PGM.innerHTML = '';
			tdDeviceTallyStatus_PGM.appendChild(spanSourcesText);
			}
		}
		trDeviceItem.appendChild(tdDeviceTallyStatus_PGM);
		let tdDeviceName = document.createElement('td');
		tdDeviceName.innerHTML = '<small><b>' + (i+1) + '</b></small>&nbsp;' + devices[i].name;
		if (devices[i].enabled === false) {
			tdDeviceName.className = 'disabled';
		}
		trDeviceItem.appendChild(tdDeviceName);
		let tdDeviceCloud = document.createElement('td');
		if (devices[i].cloudConnection) {
			let imgCloud = document.createElement('img');
			imgCloud.src = 'lib/img/cloud.png';
			imgCloud.width = '20';
			tdDeviceCloud.appendChild(imgCloud);
		}
		trDeviceItem.appendChild(tdDeviceCloud);
		let tdDeviceDescription = document.createElement('td');
		tdDeviceDescription.innerHTML = devices[i].description;
		if (devices[i].enabled === false) {
			tdDeviceDescription.className = 'disabled';
		}
		trDeviceItem.appendChild(tdDeviceDescription);
		let tdDeviceEdit = document.createElement('td');
		let btnEditDevice = document.createElement('button');
		btnEditDevice.className = 'btn btn-dark mr-1';
		btnEditDevice.innerHTML = 'Edit';
		btnEditDevice.setAttribute('onclick', 'Edit_Device(\'' + devices[i].id + '\');');
		tdDeviceEdit.appendChild(btnEditDevice);
		let btnEditDeviceSources = document.createElement('button');
		btnEditDeviceSources.className = 'btn btn-dark mr-1';
		let sourcesNum = GetDeviceSourcesByDeviceId(devices[i].id).length;
		btnEditDeviceSources.innerHTML = `Edit Sources (${sourcesNum})`;
		btnEditDeviceSources.setAttribute('onclick', 'Edit_Device_Sources(\'' + devices[i].id + '\');');
		tdDeviceEdit.appendChild(btnEditDeviceSources);
		let btnEditDeviceActions = document.createElement('button');
		btnEditDeviceActions.className = 'btn btn-dark mr-1';
		let actionsNum = GetDeviceActionsByDeviceId(devices[i].id).length;
		btnEditDeviceActions.innerHTML = `Edit Actions (${actionsNum})`;
		btnEditDeviceActions.setAttribute('onclick', 'Edit_Device_Actions(\'' + devices[i].id + '\');');
		tdDeviceEdit.appendChild(btnEditDeviceActions);
		let btnDeleteDevice = document.createElement('button');
		btnDeleteDevice.className = 'btn btn-dark mr-1';
		btnDeleteDevice.innerHTML = 'Delete';
		btnDeleteDevice.setAttribute('onclick', 'Delete_Device(\'' + devices[i].id + '\');');
		tdDeviceEdit.appendChild(btnDeleteDevice);
		let spanListeners = document.createElement('span');
		let listenerCount = GetListenersCount(devices[i].id);
		spanListeners.innerHTML = ((listenerCount > 0) ? listenerCount : '');
		spanListeners.className = ((listenerCount > 0) ? 'listenercount' : '');
		tdDeviceEdit.appendChild(spanListeners);
		trDeviceItem.appendChild(tdDeviceEdit);
		tableDevices.appendChild(trDeviceItem);
	}
	if (devices.length > 0) {
		divDevices.appendChild(tableDevices);
	}
	else {
		let spanNoDevices = document.createElement('span');
		spanNoDevices.innerHTML = '(no devices configured)';
		divDevices.appendChild(spanNoDevices);
	}
}

function loadDeviceStates() {
	for (let i = 0; i < devices.length; i++) {
		let mode_preview = false;
		let mode_program = false;
		let sources_pvw = [];
		let sources_pgm = [];
		for (let j = 0; j < device_states.length; j++) {
			if ((device_states[j].deviceId === devices[i].id) && (getBusById(device_states[j].busId).type === 'preview')) {
				if (device_states[j].sources.length > 0) {
					mode_preview = true;
					sources_pvw = device_states[j].sources;
				}
				else {
					mode_preview = false;
				}
			}
			else if ((device_states[j].deviceId === devices[i].id) && (getBusById(device_states[j].busId).type === 'program')) {
				if (device_states[j].sources.length > 0) {
					mode_program = true;
					sources_pgm = device_states[j].sources;
				}
				else {
					mode_program = false;
				}
			}
		}
		let tdDeviceTallyStatus_PVW = document.getElementById('td_tallyPVW_' + devices[i].id);
		if (tdDeviceTallyStatus_PVW) {
			if (mode_preview) {
				tdDeviceTallyStatus_PVW.className = 'device_state_tally_preview';
				if (sources_pvw.length > 0) {
					let spanSourcesText = document.createElement('span');
					spanSourcesText.className = 'sources_pvw_tooltip';
					let sourceText = '';
					for (let j = 0; j < sources_pvw.length; j++) {
						sourceText += GetSourceById(sources_pvw[j].sourceId).name;
						if ((j > 0) && (j < sources_pvw.length - 1)) {
							sourceText += ', ';
						}
					}
					spanSourcesText.innerHTML = sourceText;
					tdDeviceTallyStatus_PVW.innerHTML = '';
					tdDeviceTallyStatus_PVW.appendChild(spanSourcesText);
				}
			}
			else {
				tdDeviceTallyStatus_PVW.className = 'device_state_tally';
				tdDeviceTallyStatus_PVW.innerHTML = '';
			}
		}
		let tdDeviceTallyStatus_PGM = document.getElementById('td_tallyPGM_' + devices[i].id);
		if (tdDeviceTallyStatus_PGM) {
			if (mode_program) {
				tdDeviceTallyStatus_PGM.className = 'device_state_tally_program';
				if (sources_pgm.length > 0) {
					let spanSourcesText = document.createElement('span');
					spanSourcesText.className = 'sources_pgm_tooltip';
					let sourceText = '';
					for (let j = 0; j < sources_pgm.length; j++) {
						sourceText += GetSourceById(sources_pgm[j].sourceId).name;
						if ((j > 0) && (j < sources_pgm.length - 1)) {
							sourceText += ', ';
						}
					}
					spanSourcesText.innerHTML = sourceText;
					tdDeviceTallyStatus_PGM.innerHTML = '';
					tdDeviceTallyStatus_PGM.appendChild(spanSourcesText);
				}
			}
			else {
				tdDeviceTallyStatus_PGM.className = 'device_state_tally';
				tdDeviceTallyStatus_PGM.innerHTML = '';
			}
		}
	}
}

function loadListeners() {
	let divContainer_Listeners = $('#divContainer_Listeners')[0];
	let divListeners = $('#divListeners')[0];
	if (listener_clients.length > 0) {
	divContainer_Listeners.style.display = 'block';
	divListeners.innerHTML = '';
	let tableListeners = document.createElement('table');
	tableListeners.className = 'table';
	let trHeader = document.createElement('tr');
	let tdHeaderIPAddress = document.createElement('td');
	tdHeaderIPAddress.innerHTML = '<b>IP Address</b>';
	trHeader.appendChild(tdHeaderIPAddress);
	let tdHeaderListenerType = document.createElement('td');
	tdHeaderListenerType.innerHTML = '<b>Type</b>';
	tdHeaderListenerType.style.background = '#eeeeee';
	trHeader.appendChild(tdHeaderListenerType);
	let tdHeaderListenerCloud = document.createElement('td');
	tdHeaderListenerCloud.innerHTML = '&nbsp;';
	trHeader.appendChild(tdHeaderListenerCloud);
	let tdHeaderDeviceName = document.createElement('td');
	tdHeaderDeviceName.innerHTML = '<b>Device</b>';
	trHeader.appendChild(tdHeaderDeviceName);
	let tdHeaderButtons = document.createElement('td');
	tdHeaderButtons.innerHTML = '&nbsp;';
	trHeader.appendChild(tdHeaderButtons);
	tableListeners.appendChild(trHeader);
	for (let i = 0; i < listener_clients.length; i++) {
		let trClientItem = document.createElement('tr');
		let tdIPAddress = document.createElement('td');
		tdIPAddress.innerHTML = listener_clients[i].ipAddress.replace('::ffff:', '');
		trClientItem.appendChild(tdIPAddress);
		let tdListenerType = document.createElement('td');
		tdListenerType.innerHTML = listener_clients[i].listenerType;
		tdListenerType.style.background = '#eeeeee';
		trClientItem.appendChild(tdListenerType);
		let tdListenerCloud = document.createElement('td');
		if (listener_clients[i].cloudConnection) {
			let imgCloud = document.createElement('img');
			imgCloud.src = 'lib/img/cloud.png';
			imgCloud.width = '20';
			tdListenerCloud.appendChild(imgCloud);
		}
		trClientItem.appendChild(tdListenerCloud);
		let tdDevice = document.createElement('td');
		if (listener_clients[i].cloudConnection) {
			let spanDevice = document.createElement('span');
			spanDevice.innerHTML = GetDeviceById(listener_clients[i].deviceId).name;
			tdDevice.appendChild(spanDevice);
		}
		else {
			let selDevices = document.createElement('select');
			for (let j = 0; j < devices.length; j++) {
				let optDevice = document.createElement('option');
				optDevice.textContent = devices[j].name;
				optDevice.value = devices[j].id;
				if (devices[j].id === listener_clients[i].deviceId) {
					optDevice.selected = true;
				}
				selDevices.appendChild(optDevice);
			}
			selDevices.id = 'selListenerReassign_' + listener_clients[i].id;
			selDevices.setAttribute('onchange', 'Listener_Reassign(\'' + listener_clients[i].id + '\');');
			tdDevice.appendChild(selDevices);
		}
		trClientItem.appendChild(tdDevice);
		let tdButtons = document.createElement('td');
		if (listener_clients[i].inactive === true) {
			trClientItem.className = 'disabled';
			let btnDelete = document.createElement('button');
			btnDelete.className = 'btn btn-dark mr-1';
			btnDelete.innerHTML = 'X';
			btnDelete.setAttribute('onclick', 'Listener_Delete(\'' + listener_clients[i].id + '\');');
			tdButtons.appendChild(btnDelete);
		}
		else {
			let btnFlash = document.createElement('button');
			btnFlash.className = 'btn btn-dark mr-1';
			btnFlash.innerHTML = 'Flash';
			btnFlash.setAttribute('onclick', 'Listener_Flash(\'' + listener_clients[i].id + '\');');
			tdButtons.appendChild(btnFlash);
		}
		trClientItem.appendChild(tdButtons);
		tableListeners.appendChild(trClientItem);
	}
	divListeners.appendChild(tableListeners);
	}
	else {
	divContainer_Listeners.style.display = 'block';
	divListeners.innerHTML = 'No listeners connected';
	}
}

function loadTSLClients() {
	let divTSLClients = $('#divTSLClients')[0];
	divTSLClients.innerHTML = '';
	let tableTSLClients = document.createElement('table');
	let trHeader = document.createElement('tr');
	let tdHeaderTSLIP = document.createElement('td');
	tdHeaderTSLIP.innerHTML = '<b>IP</b>';
	trHeader.appendChild(tdHeaderTSLIP);
	let tdHeaderTSLPort = document.createElement('td');
	tdHeaderTSLPort.innerHTML = '<b>Port</b>';
	trHeader.appendChild(tdHeaderTSLPort);
	let tdHeaderTSLTransport = document.createElement('td');
	tdHeaderTSLTransport.innerHTML = '<b>Transport</b>';
	trHeader.appendChild(tdHeaderTSLTransport);
	let tdHeaderTSLEdit = document.createElement('td');
	tdHeaderTSLEdit.innerHTML = '&nbsp;';
	trHeader.appendChild(tdHeaderTSLEdit);
	tableTSLClients.appendChild(trHeader);
	for (let i = 0; i < tsl_clients.length; i++) {
		let trItem = document.createElement('tr');
		if (tsl_clients[i].connected === true) {
			trItem.className = 'tsl_client_connected';
		}
		else {
			trItem.className = 'tsl_client_disconnected';
		}
		if (tsl_clients[i].error === true) {
			trItem.className = 'tsl_client_error';
		}
		let tdTSLIP = document.createElement('td');
		tdTSLIP.innerHTML = tsl_clients[i].ip;
		trItem.appendChild(tdTSLIP);
		let tdTSLPort = document.createElement('td');
		tdTSLPort.innerHTML = tsl_clients[i].port;
		trItem.appendChild(tdTSLPort);
		let tdTSLTransport = document.createElement('td');
		tdTSLTransport.innerHTML = tsl_clients[i].transport;
		trItem.appendChild(tdTSLTransport);
		let tdTSLEdit = document.createElement('td');
		let btnEdit = document.createElement('button');
		btnEdit.className = 'btn btn-dark mr-1';
		btnEdit.innerHTML = 'Edit';
		btnEdit.setAttribute('onclick', 'Edit_TSL_Client(\'' + tsl_clients[i].id + '\');');
		tdTSLEdit.appendChild(btnEdit);
		let btnDelete = document.createElement('button');
		btnDelete.className = 'btn btn-dark mr-1';
		btnDelete.innerHTML = 'Delete';
		btnDelete.setAttribute('onclick', 'Delete_TSL_Client(\'' + tsl_clients[i].id + '\');');
		tdTSLEdit.appendChild(btnDelete);
		trItem.appendChild(tdTSLEdit);
		tableTSLClients.appendChild(trItem);
	}
	if (tsl_clients.length > 0) {
		divTSLClients.appendChild(tableTSLClients);
	}
	else {
		let spanNoItems = document.createElement('span');
		spanNoItems.innerHTML = '(no TSL clients configured)';
		divTSLClients.appendChild(spanNoItems);
	}
}

function loadCloudDestinations() {
	let divCloudDestinations = $('#divCloudDestinations')[0];
	divCloudDestinations.innerHTML = '';
	let tableCloudDestinations = document.createElement('table');
	let trHeader = document.createElement('tr');
	let tdHeaderHost = document.createElement('td');
	tdHeaderHost.innerHTML = '<b>Host</b>';
	trHeader.appendChild(tdHeaderHost);
	let tdHeaderPort = document.createElement('td');
	tdHeaderPort.innerHTML = '<b>Port</b>';
	trHeader.appendChild(tdHeaderPort);
	let tdHeaderKey = document.createElement('td');
	tdHeaderKey.innerHTML = '<b>Key</b>';
	trHeader.appendChild(tdHeaderKey);
	let tdHeaderEdit = document.createElement('td');
	tdHeaderEdit.innerHTML = '&nbsp;';
	trHeader.appendChild(tdHeaderEdit);
	tableCloudDestinations.appendChild(trHeader);
	for (let i = 0; i < cloud_destinations.length; i++) {
		let trItem = document.createElement('tr');
		if (cloud_destinations[i].status === 'connected') {
			trItem.className = 'cloud_destination_connected';
		}
		else if (cloud_destinations[i].status === 'disconnected') {
			trItem.className = 'cloud_destination_disconnected';
		}
		else if (cloud_destinations[i].status === 'invalid-key') {
			trItem.className = 'cloud_destination_invalidkey';
		}
		else if (cloud_destinations[i].status === 'error') {
			trItem.className = 'cloud_destination_error';
		}
		if (cloud_destinations[i].error === true) {
			trItem.className = 'cloud_destination_error';
		}
		let tdHost = document.createElement('td');
		tdHost.innerHTML = cloud_destinations[i].host;
		trItem.appendChild(tdHost);
		let tdPort = document.createElement('td');
		tdPort.innerHTML = cloud_destinations[i].port;
		trItem.appendChild(tdPort);
		let tdKey = document.createElement('td');
		tdKey.innerHTML = cloud_destinations[i].key;
		trItem.appendChild(tdKey);
		let tdEdit = document.createElement('td');
		let btnEdit = document.createElement('button');
		btnEdit.className = 'btn btn-dark mr-1';
		btnEdit.innerHTML = 'Edit';
		btnEdit.setAttribute('onclick', 'Edit_Cloud_Destination(\'' + cloud_destinations[i].id + '\');');
		tdEdit.appendChild(btnEdit);
		let btnDelete = document.createElement('button');
		btnDelete.className = 'btn btn-dark mr-1';
		btnDelete.innerHTML = 'Delete';
		btnDelete.setAttribute('onclick', 'Delete_Cloud_Destination(\'' + cloud_destinations[i].id + '\');');
		tdEdit.appendChild(btnDelete);
		if (cloud_destinations[i].status === 'disconnected') {
			let btnReconnect = document.createElement('button');
			btnReconnect.className = 'btn btn-dark mr-1';
			btnReconnect.innerHTML = 'Reconnect';
			btnReconnect.setAttribute('onclick', 'Reconnect_Cloud_Destination(\'' + cloud_destinations[i].id + '\');');
			tdEdit.appendChild(btnReconnect);
		}
		else if (cloud_destinations[i].status === 'connected') {
			let btnDisconnect = document.createElement('button');
			btnDisconnect.className = 'btn btn-dark mr-1';
			btnDisconnect.innerHTML = 'Disconnect';
			btnDisconnect.setAttribute('onclick', 'Disconnect_Cloud_Destination(\'' + cloud_destinations[i].id + '\');');
			tdEdit.appendChild(btnDisconnect);
		}
		trItem.appendChild(tdEdit);
		tableCloudDestinations.appendChild(trItem);
	}
	if (cloud_destinations.length > 0) {
	divCloudDestinations.appendChild(tableCloudDestinations);
	}
	else {
	let spanNoItems = document.createElement('span');
	spanNoItems.innerHTML = '(no cloud destinations configured)';
	divCloudDestinations.appendChild(spanNoItems);
	}
}

function loadCloudKeys() {
	let divCloudKeys = $('#divCloudKeys')[0];
	divCloudKeys.innerHTML = '';
	let tableCloudKeys = document.createElement('table');
	for (let i = 0; i < cloud_keys.length; i++) {
		let trItem = document.createElement('tr');
		let tdKey = document.createElement('td');
		tdKey.innerHTML = cloud_keys[i];
		trItem.appendChild(tdKey);
		let tdDelete = document.createElement('td');
		let btnDelete = document.createElement('button');
		btnDelete.className = 'btn btn-dark mr-1';
		btnDelete.innerHTML = 'Delete';
		btnDelete.setAttribute('onclick', 'Delete_Cloud_Key(\'' + cloud_keys[i] + '\');');
		tdDelete.appendChild(btnDelete);
		trItem.appendChild(tdDelete);
		tableCloudKeys.appendChild(trItem);
	}
	if (cloud_keys.length > 0) {
		divCloudKeys.appendChild(tableCloudKeys);
	}
	else {
		let spanNoItems = document.createElement('span');
		spanNoItems.innerHTML = '(no cloud keys configured)';
		divCloudKeys.appendChild(spanNoItems);
	}
}

function loadCloudClients() {
	let divCloudClients = $('#divCloudClients')[0];
	divCloudClients.innerHTML = '';
	let tableCloudClients = document.createElement('table');
	if (cloud_clients.length > 0) {
		for (let i = 0; i < cloud_clients.length; i++) {
			let trItem = document.createElement('tr');
			let tdIP = document.createElement('td');
			tdIP.innerHTML = cloud_clients[i].ipAddress.replace('::ffff:', '');
			trItem.appendChild(tdIP);
			let tdKey = document.createElement('td');
			tdKey.innerHTML = cloud_clients[i].key;
			trItem.appendChild(tdKey);
			let tdRemove = document.createElement('td');
			let btnRemove = document.createElement('button');
			btnRemove.className = 'btn btn-dark mr-1';
			btnRemove.innerHTML = 'Remove';
			btnRemove.setAttribute('onclick', 'Remove_Cloud_Client(\'' + cloud_clients[i].id + '\');');
			tdRemove.appendChild(btnRemove);
			trItem.appendChild(tdRemove);
			tableCloudClients.appendChild(trItem);
		}
	divCloudClients.appendChild(tableCloudClients);
	}
	else {
		let spanNoItems = document.createElement('span');
		spanNoItems.innerHTML = '(no cloud clients connected)';
		divCloudClients.appendChild(spanNoItems);
	}
}

function Listener_Flash(id) {
	socket.emit('flash', id);
}

function Listener_Delete(clientId) {
	socket.emit('listener_delete', clientId);
}

function Listener_Reassign(id) {
	let clientObj = GetListenerClientById(id);
	let selListenerReassign = $('#selListenerReassign_' + id)[0];
	let deviceId = selListenerReassign.options[selListenerReassign.selectedIndex].value;
	let oldDeviceId = clientObj.deviceId;
	let clientId = clientObj.id;
	socket.emit('reassign', clientId, oldDeviceId, deviceId);
}

function loadLogs() {
	let divContainer_Logs = $('#divContainer_Logs')[0];
	let divLogs = $('#divLogs')[0];
	divContainer_Logs.style.display = 'block';
	divLogs.innerHTML = '';
	for (let i = 0; i < Logs.length; i++) {
		let spanLog = document.createElement('span');
		spanLog.innerHTML = `[${Logs[i].datetime}]  ${Logs[i].log}<br />`;
		switch (Logs[i].type) {
			case 'info':
				spanLog.style.color = '#0000FF';
				break;
			case 'error':
				spanLog.style.color = '#FF0000';
				break;
			case 'console_action':
				spanLog.style.color = '#00FF00';
				break;
			}
		divLogs.appendChild(spanLog);
	}
	divLogs.scrollTop = divLogs.scrollHeight;
}

function AddLog(logObj) {
	let divContainer_Logs = $('#divContainer_Logs')[0];
	let divLogs = $('#divLogs')[0];
	let spanLog = document.createElement('span');
	spanLog.innerHTML = `[${logObj.datetime}]  ${logObj.log}<br />`;
	switch (logObj.type) {
	case 'info':
		spanLog.style.color = '#0000FF';
		break;
	case 'error':
		spanLog.style.color = '#FF0000';
		break;
	case 'console_action':
		spanLog.style.color = '#00FF00';
		break;
	}
	divLogs.appendChild(spanLog);
	divLogs.scrollTop = divLogs.scrollHeight;
}

function AddTallyData(sourceId, tallyObj) {
	let source = GetSourceById(sourceId);
	let divContainer_TallyData = $('#divContainer_TallyData')[0];
	let divTallyData = $('#divTallyData')[0];
	let spanTally = document.createElement('span');
	let tallyPreview = (tallyObj.tally1 === 1 ? 'True' : 'False');
	let tallyProgram = (tallyObj.tally2 === 1 ? 'True' : 'False');
	let today = new Date();
	let date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
	let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
	let dateTime = date + ' ' + time;
	spanTally.innerHTML = `[${dateTime}]  Source: ${source.name}  Address: ${tallyObj.address}  Label: ${tallyObj.label}  PVW: ${tallyPreview}  PGM: ${tallyProgram}<br />`;
	divTallyData.appendChild(spanTally);
	divTallyData.scrollTop = divTallyData.scrollHeight;
}

function GetListenersCount(deviceId) {
	let j = 0;
	for (let i = 0; i < listener_clients.length; i++) {
		if ((listener_clients[i].deviceId === deviceId) && (listener_clients[i].inactive === false)) {
			j++;
		}
	}
	return j;
}

function GetListenerClientById(clientId) {
	//gets the Client by the Id
	return listener_clients.find(({id}) => id === clientId);
}

function GetSourceById(sourceId) {
	//gets the Source by the Id
	return sources.find(({id}) => id === sourceId);
}

function GetSourceTypeById(sourceTypeId) {
	//gets the Source Type by the Id
	return source_types.find(({id}) => id === sourceTypeId);
}

function getBusById(busId) {
	//gets the bus type (preview/program) by the bus id
	return bus_options.find(({id}) => id === busId);
}

function GetOutputTypeById(outputTypeId) {
	//gets the Source Type by the Id
	return output_types.find(({id}) => id === outputTypeId);
}

function GetDeviceById(deviceId) {
	//gets the Device by the Id
	if (deviceId !== 'unassigned') {
		return devices.find(({id}) => id === deviceId);
	}
	else {
		let deviceObj = {};
		deviceObj.id = 'unassigned';
		deviceObj.name = 'Unassigned';
		return deviceObj;
	}
}

function GetDeviceSourceById(deviceSourceId) {
	//gets the Device Source by the Id
	return device_sources.find(({id}) => id === deviceSourceId);
}

function GetDeviceSourcesByDeviceId(deviceId) {
	//gets the Device Sources by Device Id
	return device_sources.filter(obj => obj.deviceId === deviceId);
}

function GetDeviceActionById(deviceActionId) {
	//gets the Device Actions by the Id
	return device_actions.find(({id}) => id === deviceActionId);
}

function GetDeviceActionsByDeviceId(deviceId) {
	//gets the Device Actions by Device Id
	return device_actions.filter(obj => obj.deviceId === deviceId);
}

function GetTSLClientById(tslClientId) {
	//gets the TSL Client by the Id
	return tsl_clients.find(({id}) => id === tslClientId);
}

function GetCloudDestinationById(cloudId) {
	//gets the Cloud Destination by the Id
	return cloud_destinations.find(({id}) => id === cloudId);
}

function Add_Source() {
	let divSourceFields = $('#divSourceFields')[0];
	divSourceFields.innerHTML = '';
	let selSourceType = $('#selSourceType')[0];
	selSourceType.setAttribute('onchange', 'Add_Source_ShowFields();');
	selSourceType.style.display = 'block';
	selSourceType.options.length = 0;

	let elChoose = document.createElement('option');
	elChoose.text = '(Choose Source Type)';
	elChoose.value = '-1';

	selSourceType.appendChild(elChoose);
	for (let i = 0; i < source_types.length; i++) {
		if (source_types[i].enabled === true) {
			let opt = source_types[i];
			let el = document.createElement('option');
			el.textContent = opt.label;
			el.value = opt.id;
			selSourceType.appendChild(el);
		}
	}
	let btnAdd_Source_Save = $('#btnAdd_Source_Save')[0];
	btnAdd_Source_Save.style.display = 'none';
	let btnEdit_Source_Save = $('#btnEdit_Source_Save')[0];
	btnEdit_Source_Save.style.display = 'none';
	let divContainer_SourceFields = $('#divContainer_SourceFields')[0];
	divContainer_SourceFields.style.display = 'block';
}

function Add_Source_ShowFields() {
	let divSourceFields = $('#divSourceFields')[0];
	divSourceFields.innerHTML = '';
	let btnAdd_Source_Save = $('#btnAdd_Source_Save')[0];
	btnAdd_Source_Save.style.display = 'block';
	let selSourceType = $('#selSourceType')[0];
	let selectedSourceTypeId = selSourceType.options[selSourceType.selectedIndex].value;
	let sourceType = GetSourceTypeById(selectedSourceTypeId);
	let fields = source_types_datafields.find(({sourceTypeId}) => sourceTypeId === selectedSourceTypeId).fields;
	let spanHelp = document.createElement('span');
	spanHelp.innerHTML = sourceType.help;
	spanHelp.style.display = 'block';
	divSourceFields.appendChild(spanHelp);
	let spanName = document.createElement('span');
	spanName.innerHTML = 'Source Name';
	spanName.style.display = 'block';
	divSourceFields.appendChild(spanName);
	let txtName = document.createElement('input');
	txtName.type = 'text';
	txtName.id = 'txtAddSourceName';
	divSourceFields.appendChild(txtName);
	for (let i = 0; i < fields.length; i++) {
		let spanFieldName = document.createElement('span');
		spanFieldName.innerHTML = fields[i].fieldLabel;
		spanFieldName.style.display = 'block';
		divSourceFields.appendChild(spanFieldName);
		switch (fields[i].fieldType) {
		case 'text':
			let txtInput = document.createElement('input');
			txtInput.type = 'text';
			txtInput.id = fields[i].fieldName;
			divSourceFields.appendChild(txtInput);
			break;
		case 'number':
			let txtInputNumber = document.createElement('input');
			txtInputNumber.type = 'text';
			txtInputNumber.id = fields[i].fieldName;
			divSourceFields.appendChild(txtInputNumber);
			break;
		case 'port':
			let txtInputPort = document.createElement('input');
			txtInputPort.type = 'text';
			txtInputPort.id = fields[i].fieldName;
			divSourceFields.appendChild(txtInputPort);
			break;
		case 'dropdown':
			let selDropdown = document.createElement('select');
			selDropdown.id = fields[i].fieldName;
			for (let j = 0; j < fields[i].options.length; j++) {
			let elOption = document.createElement('option');
			elOption.textContent = fields[i].options[j].label;
			elOption.value = fields[i].options[j].id;
			selDropdown.appendChild(elOption);
			}
			divSourceFields.appendChild(selDropdown);
			break;
		case 'multiselect':
			let selMultiselect = document.createElement('select');
			selMultiselect.multiple = true;
			selMultiselect.id = fields[i].fieldName;
			for (let j = 0; j < fields[i].options.length; j++) {
				let elOption = document.createElement('option');
				elOption.textContent = fields[i].options[j].label;
				elOption.value = fields[i].options[j].id;
				selMultiselect.appendChild(elOption);
			}
			divSourceFields.appendChild(selMultiselect);
			$('#' + fields[i].fieldName).multiselect();
			break;
		case 'info':
			let spanInfo = document.createElement('span');
			spanInfo.id = fields[i].fieldName;
			spanInfo.innerHTML = fields[i].text;
			divSourceFields.appendChild(spanInfo);
			break;
		default:
			break;
		}
	}
}

function Add_Source_Save() {
	let sourceObj = {};
	let selSourceType = $('#selSourceType')[0];
	let selectedSourceTypeId = selSourceType.options[selSourceType.selectedIndex].value;
	if (selectedSourceTypeId === '-1') {
	alert('Invalid Source Type.');
	return false;
	}
	sourceObj.sourceTypeId = selectedSourceTypeId;
	sourceObj.enabled = true;
	sourceObj.name = $('#txtAddSourceName')[0].value;
	let dataObj = {};
	let fields = source_types_datafields.find(({sourceTypeId}) => sourceTypeId === selectedSourceTypeId).fields;
	for (let i = 0; i < fields.length; i++) {
		switch (fields[i].fieldType) {
		case 'text':
			dataObj[fields[i].fieldName] = $('#' + fields[i].fieldName)[0].value;
			break;
		case 'number':
			dataObj[fields[i].fieldName] = $('#' + fields[i].fieldName)[0].value;
			break;
		case 'port':
			//check if it's not reserved or in use first
			let checkPort = $('#' + fields[i].fieldName)[0].value;
			if (CheckPort(checkPort, '')) {
			dataObj[fields[i].fieldName] = $('#' + fields[i].fieldName)[0].value;
			}
			else {
			alert(`Network Port ${checkPort} is already in use. Please select another.`);
			return false;
			}
			break;
		case 'dropdown':
			dataObj[fields[i].fieldName] = $('#' + fields[i].fieldName)[0].options($('#' + fields[i].fieldName)[0].selectedIndex).value;
			break;
		case 'multiselect':
			dataObj[fields[i].fieldName] = $('#' + fields[i].fieldName).val();
			break;
		default:
			break;
		}
	}
	sourceObj.reconnect = true;
	sourceObj.data = dataObj;
	let arbiterObj = {};
	arbiterObj.action = 'add';
	arbiterObj.type = 'source';
	arbiterObj.source = sourceObj;
	socket.emit('manage', arbiterObj);
}

function Edit_Source(sourceId) {
	let divSourceFields = $('#divSourceFields')[0];
	let selSourceType = $('#selSourceType')[0];
	selSourceType.style.display = 'none';
	divSourceFields.innerHTML = '';
	let source = GetSourceById(sourceId);
	let sourceType = GetSourceTypeById(source.sourceTypeId);
	let spanSourceIdName = document.createElement('span');
	spanSourceIdName.innerHTML = 'Source Id:';
	spanSourceIdName.style.display = 'block';
	divSourceFields.appendChild(spanSourceIdName);
	let txtSourceId = document.createElement('input');
	txtSourceId.type = 'text';
	txtSourceId.id = 'txtSourceId';
	txtSourceId.value = source.id;
	txtSourceId.style.display = 'block';
	txtSourceId.disabled = true;
	divSourceFields.appendChild(txtSourceId);
	let spanSourceType = document.createElement('span');
	spanSourceType.innerHTML = 'Source Type:';
	spanSourceType.style.display = 'block';
	divSourceFields.appendChild(spanSourceType);
	let spanSourceTypeName = document.createElement('span');
	spanSourceTypeName.innerHTML = sourceType.label;
	spanSourceTypeName.style.fontWeight = 'bold';
	spanSourceTypeName.style.display = 'block';
	divSourceFields.appendChild(spanSourceTypeName);
	let spanHelp = document.createElement('span');
	spanHelp.innerHTML = sourceType.help;
	spanHelp.style.display = 'block';
	divSourceFields.appendChild(spanHelp);
	let spanName = document.createElement('span');
	spanName.innerHTML = 'Source Name';
	spanName.style.display = 'block';
	divSourceFields.appendChild(spanName);
	let txtSourceName = document.createElement('input');
	txtSourceName.type = 'text';
	txtSourceName.id = 'txtSourceName';
	txtSourceName.value = source.name;
	txtSourceName.style.display = 'block';
	divSourceFields.appendChild(txtSourceName);
	let fields = source_types_datafields.find(({
	sourceTypeId
	}) => sourceTypeId === sourceType.id).fields;
	for (let i = 0; i < fields.length; i++) {
		let spanFieldName = document.createElement('span');
		spanFieldName.innerHTML = fields[i].fieldLabel;
		spanFieldName.style.display = 'block';
		divSourceFields.appendChild(spanFieldName);
		switch (fields[i].fieldType) {
		case 'text':
			let txtInput = document.createElement('input');
			txtInput.type = 'text';
			txtInput.id = fields[i].fieldName;
			txtInput.value = source.data[fields[i].fieldName];
			divSourceFields.appendChild(txtInput);
			break;
		case 'number':
			let txtInputNumber = document.createElement('input');
			txtInputNumber.type = 'text';
			txtInputNumber.id = fields[i].fieldName;
			txtInputNumber.value = source.data[fields[i].fieldName];
			divSourceFields.appendChild(txtInputNumber);
			break;
		case 'port':
			let txtInputPort = document.createElement('input');
			txtInputPort.type = 'text';
			txtInputPort.id = fields[i].fieldName;
			txtInputPort.value = source.data[fields[i].fieldName];
			divSourceFields.appendChild(txtInputPort);
			break;
		case 'dropdown':
			let selDropdown = document.createElement('select');
			selDropdown.id = fields[i].fieldName;
			for (let j = 0; j < fields[i].options.length; j++) {
			let elOption = document.createElement('option');
			elOption.textContent = fields[i].options[j].label;
			elOption.value = fields[i].options[j].id;
			if (source.data[fields[i].fieldName] === fields[i].options[j].id) {
				elOption.selected = true;
			}
			selDropdown.appendChild(elOption);
			}
			divSourceFields.appendChild(selDropdown);
			break;
		case 'multiselect':
			let selMultiselect = document.createElement('select');
			selMultiselect.multiple = true;
			selMultiselect.id = fields[i].fieldName;
			for (let j = 0; j < fields[i].options.length; j++) {
				let elOption = document.createElement('option');
				elOption.textContent = fields[i].options[j].label;
				elOption.value = fields[i].options[j].id;
				if (source.data[fields[i].fieldName].includes(fields[i].options[j].id)) {
					elOption.selected = true;
				}
				selMultiselect.appendChild(elOption);
			}
			divSourceFields.appendChild(selMultiselect);
			$('#' + fields[i].fieldName).multiselect();
			break;
		case 'info':
			let spanInfo = document.createElement('span');
			spanInfo.id = fields[i].fieldName;
			spanInfo.innerHTML = fields[i].text;
			divSourceFields.appendChild(spanInfo);
			break;
		default:
			break;
		}
	}
	let spanEnabled = document.createElement('span');
	spanEnabled.innerHTML = 'Enabled';
	spanEnabled.style.display = 'block';
	divSourceFields.appendChild(spanEnabled);
	let chkEnabled = document.createElement('input');
	chkEnabled.id = 'chkSourceEnabled';
	chkEnabled.type = 'checkbox';
	if (source.enabled === true) {
	chkEnabled.checked = true;
	}
	divSourceFields.appendChild(chkEnabled);
	let spanReconnect = document.createElement('span');
	spanReconnect.innerHTML = 'Reconnect';
	spanReconnect.style.display = 'block';
	divSourceFields.appendChild(spanReconnect);
	let chkReconnect = document.createElement('input');
	chkReconnect.id = 'chkSourceReconnect';
	chkReconnect.type = 'checkbox';
	if (source.reconnect === true) {
	chkReconnect.checked = true;
	}
	divSourceFields.appendChild(chkReconnect);
	let btnAdd_Source_Save = $('#btnAdd_Source_Save')[0];
	btnAdd_Source_Save.style.display = 'none';
	let btnEdit_Source_Save = $('#btnEdit_Source_Save')[0];
	btnEdit_Source_Save.style.display = 'block';
	let divContainer_SourceFields = $('#divContainer_SourceFields')[0];
	divContainer_SourceFields.style.display = 'block';
	$("#addSource").modal();
}

function Edit_Source_Save() {
	let sourceObj = {};
	sourceObj.id = $('#txtSourceId')[0].value;
	sourceObj.name = $('#txtSourceName')[0].value;
	sourceObj.enabled = $('#chkSourceEnabled')[0].checked;
	sourceObj.reconnect = $('#chkSourceReconnect')[0].checked;
	let source = GetSourceById(sourceObj.id);
	let sourceType = GetSourceTypeById(source.sourceTypeId);
	let dataObj = {};
	let fields = source_types_datafields.find(({sourceTypeId}) => sourceTypeId === sourceType.id).fields;
	for (let i = 0; i < fields.length; i++) {
		switch (fields[i].fieldType) {
		case 'text':
			dataObj[fields[i].fieldName] = $('#' + fields[i].fieldName)[0].value;
			break;
		case 'number':
			dataObj[fields[i].fieldName] = $('#' + fields[i].fieldName)[0].value;
			break;
		case 'port':
			//check if reserved or in use first
			let checkPort = $('#' + fields[i].fieldName)[0].value;
			if (CheckPort(checkPort, sourceObj.id)) {
			dataObj[fields[i].fieldName] = $('#' + fields[i].fieldName)[0].value;
			}
			else {
			alert(`Network Port ${checkPort} is already in use. Please select another.`);
			return false;
			}
			break;
		case 'dropdown':
			dataObj[fields[i].fieldName] = $('#' + fields[i].fieldName)[0].options($('#' + fields[i].fieldName)[0].selectedIndex).value;
			break;
		case 'multiselect':
			dataObj[fields[i].fieldName] = $('#' + fields[i].fieldName).val();
			break;
		default:
			break;
		}
	}
	sourceObj.data = dataObj;
	let arbiterObj = {};
	arbiterObj.action = 'edit';
	arbiterObj.type = 'source';
	arbiterObj.source = sourceObj;
	socket.emit('manage', arbiterObj);
}

function Delete_Source(sourceId) {
	let result = confirm('Are you sure you want to delete this source?');
	if (!result) {
		return false;
	}
	let arbiterObj = {};
	arbiterObj.action = 'delete';
	arbiterObj.type = 'source';
	arbiterObj.sourceId = sourceId;
	socket.emit('manage', arbiterObj);
}

function Cancel_Source() {
	$('#divContainer_SourceFields')[0].style.display = 'none';
}

function Add_Device() {
	$('#divContainer_DeviceFields')[0].style.display = 'block';
	let divDeviceFields = $('#divDeviceFields')[0];
	divDeviceFields.innerHTML = '';
	let spanName = document.createElement('span');
	spanName.innerHTML = 'Device Name';
	spanName.style.display = 'block';
	divDeviceFields.appendChild(spanName);
	let txtName = document.createElement('input');
	txtName.type = 'text';
	txtName.id = 'txtAddDeviceName';
	divDeviceFields.appendChild(txtName);
	let spanDescription = document.createElement('span');
	spanDescription.innerHTML = 'Device Description';
	spanDescription.style.display = 'block';
	divDeviceFields.appendChild(spanDescription);
	let txtDescription = document.createElement('input');
	txtDescription.type = 'text';
	txtDescription.id = 'txtAddDeviceDescription';
	divDeviceFields.appendChild(txtDescription);
	let spanTSLAddress = document.createElement('span');
	spanTSLAddress.innerHTML = 'TSL Address';
	spanTSLAddress.style.display = 'block';
	divDeviceFields.appendChild(spanTSLAddress);
	let txtTSLAddress = document.createElement('input');
	txtTSLAddress.type = 'text';
	txtTSLAddress.id = 'txtAddTSLAddress';
	divDeviceFields.appendChild(txtTSLAddress);
	$('#btnAdd_Device_Save')[0].style.display = 'block';
	$('#btnEdit_Device_Save')[0].style.display = 'none';
}

function Add_Device_Save() {
	let deviceObj = {};
	deviceObj.name = $('#txtAddDeviceName')[0].value;
	deviceObj.description = $('#txtAddDeviceDescription')[0].value;
	deviceObj.tslAddress = $('#txtAddTSLAddress')[0].value;
	deviceObj.enabled = true;
	let arbiterObj = {};
	arbiterObj.action = 'add';
	arbiterObj.type = 'device';
	arbiterObj.device = deviceObj;
	socket.emit('manage', arbiterObj);
}

function Edit_Device(deviceId) {
	let divDeviceFields = $('#divDeviceFields')[0];
	divDeviceFields.innerHTML = '';
	let device = GetDeviceById(deviceId);
	let spanDeviceIdName = document.createElement('span');
	spanDeviceIdName.innerHTML = 'Device Id:';
	spanDeviceIdName.style.display = 'block';
	divDeviceFields.appendChild(spanDeviceIdName);
	let txtDeviceId = document.createElement('input');
	txtDeviceId.type = 'text';
	txtDeviceId.id = 'txtDeviceId';
	txtDeviceId.value = device.id;
	txtDeviceId.style.display = 'block';
	txtDeviceId.disabled = true;
	divDeviceFields.appendChild(txtDeviceId);
	let spanName = document.createElement('span');
	spanName.innerHTML = 'Device Name';
	spanName.style.display = 'block';
	divDeviceFields.appendChild(spanName);
	let txtDeviceName = document.createElement('input');
	txtDeviceName.type = 'text';
	txtDeviceName.id = 'txtDeviceName';
	txtDeviceName.value = device.name;
	txtDeviceName.style.display = 'block';
	divDeviceFields.appendChild(txtDeviceName);
	let spanDescription = document.createElement('span');
	spanDescription.innerHTML = 'Device Description';
	spanDescription.style.display = 'block';
	divDeviceFields.appendChild(spanDescription);
	let txtDeviceDescription = document.createElement('input');
	txtDeviceDescription.type = 'text';
	txtDeviceDescription.id = 'txtDeviceDescription';
	txtDeviceDescription.value = device.description;
	txtDeviceDescription.style.display = 'block';
	divDeviceFields.appendChild(txtDeviceDescription);
	let spanTSLAddress = document.createElement('span');
	spanTSLAddress.innerHTML = 'TSL Address';
	spanTSLAddress.style.display = 'block';
	divDeviceFields.appendChild(spanTSLAddress);
	let txtTSLAddress = document.createElement('input');
	txtTSLAddress.type = 'text';
	txtTSLAddress.id = 'txtDeviceTSLAddress';
	txtTSLAddress.value = (device.tslAddress) ? device.tslAddress : '0';
	txtTSLAddress.style.display = 'block';
	divDeviceFields.appendChild(txtTSLAddress);
	let spanEnabled = document.createElement('span');
	spanEnabled.innerHTML = 'Enabled';
	spanEnabled.style.display = 'block';
	divDeviceFields.appendChild(spanEnabled);
	let chkEnabled = document.createElement('input');
	chkEnabled.id = 'chkDeviceEnabled';
	chkEnabled.type = 'checkbox';
	if (device.enabled === true) {
		chkEnabled.checked = true;
	}
	divDeviceFields.appendChild(chkEnabled);
	let btnAdd_Device_Save = $('#btnAdd_Device_Save')[0];
	btnAdd_Device_Save.style.display = 'none';
	let btnEdit_Device_Save = $('#btnEdit_Device_Save')[0];
	btnEdit_Device_Save.style.display = 'block';
	$('#divContainer_DeviceFields')[0].style.display = 'block';
	$('#divContainer_DeviceSources')[0].style.display = 'none';
	$('#divContainer_DeviceSourceFields')[0].style.display = 'none';
	$('#divContainer_DeviceActions')[0].style.display = 'none';
	$('#divContainer_DeviceActionFields')[0].style.display = 'none';
	selectedDeviceId = deviceId;
	$("#addDevice").modal();
}

function Edit_Device_Save() {
	let deviceObj = {};
	deviceObj.id = selectedDeviceId;
	deviceObj.name = $('#txtDeviceName')[0].value;
	deviceObj.description = $('#txtDeviceDescription')[0].value;
	deviceObj.tslAddress = $('#txtDeviceTSLAddress')[0].value;
	deviceObj.enabled = $('#chkDeviceEnabled')[0].checked;
	let arbiterObj = {};
	arbiterObj.action = 'edit';
	arbiterObj.type = 'device';
	arbiterObj.device = deviceObj;
	socket.emit('manage', arbiterObj);
}

function Cancel_Device() {
	$('#divContainer_DeviceFields')[0].style.display = 'none';
}

function Delete_Device(deviceId) {
	let result = confirm('Are you sure you want to delete this device?');
	if (!result) {
		return false;
	}
	let arbiterObj = {};
	arbiterObj.action = 'delete';
	arbiterObj.type = 'device';
	arbiterObj.deviceId = deviceId;
	let listenerCount = GetListenersCount(deviceId);
	if (listenerCount > 0) {
		let result = confirm('There are listeners connected to this device. Delete anyway?');
		if (!result) {
			return false;
		}
	}
	socket.emit('manage', arbiterObj);
}

function Edit_Device_Sources(deviceId) {
	let divDeviceSources = $('#divDeviceSources')[0];
	divDeviceSources.innerHTML = '';
	$('#divDeviceSources_DeviceName')[0].innerHTML = GetDeviceById(deviceId).name;
	let tableDeviceSources = document.createElement('table');
	let trHeader = document.createElement('tr');
	let tdHeaderDeviceSource = document.createElement('td');
	tdHeaderDeviceSource.innerHTML = '<b>Source</b>';
	trHeader.appendChild(tdHeaderDeviceSource);
	let tdHeaderDeviceSourceAddress = document.createElement('td');
	tdHeaderDeviceSourceAddress.innerHTML = '<b>Address</b>';
	trHeader.appendChild(tdHeaderDeviceSourceAddress);
	let tdHeaderDeviceSourceEdit = document.createElement('td');
	tdHeaderDeviceSourceEdit.innerHTML = '&nbsp;';
	trHeader.appendChild(tdHeaderDeviceSourceEdit);
	tableDeviceSources.appendChild(trHeader);
	for (let i = 0; i < device_sources.length; i++) {
		if (device_sources[i].deviceId === deviceId) {
			let trDeviceSourceItem = document.createElement('tr');
			let device_source = GetSourceById(device_sources[i].sourceId);
			let tdDeviceSource = document.createElement('td');
			tdDeviceSource.innerHTML = device_source.name;
			trDeviceSourceItem.appendChild(tdDeviceSource);
			let sourceType = GetSourceTypeById(device_source.sourceTypeId);
			let tdDeviceSourceAddress = document.createElement('td');
			switch (sourceType.type) {
				case "atem":
					tdDeviceSourceAddress.innerHTML = device_sources[i].address;
					for (let j = 0; j < TallyAddresses_ATEM.length; j++) {
						if (TallyAddresses_ATEM[j].address.toString() === device_sources[i].address) {
						tdDeviceSourceAddress.innerHTML = TallyAddresses_ATEM[j].label;
						break;
						}
					}
					break;
				default:
					tdDeviceSourceAddress.innerHTML = device_sources[i].address;
					break;
			}
			trDeviceSourceItem.appendChild(tdDeviceSourceAddress);
			let tdDeviceEdit = document.createElement('td');
			let btnEditDeviceSource = document.createElement('button');
			btnEditDeviceSource.className = 'btn btn-dark mr-1';
			btnEditDeviceSource.innerHTML = 'Edit';
			btnEditDeviceSource.setAttribute('onclick', 'Edit_Device_Source(\'' + device_sources[i].id + '\');');
			tdDeviceEdit.appendChild(btnEditDeviceSource);
			let btnDeleteDevice = document.createElement('button');
			btnDeleteDevice.className = 'btn btn-dark mr-1';
			btnDeleteDevice.innerHTML = 'Delete';
			btnDeleteDevice.setAttribute('onclick', 'Delete_Device_Source(\'' + device_sources[i].id + '\');');
			tdDeviceEdit.appendChild(btnDeleteDevice);
			trDeviceSourceItem.appendChild(tdDeviceEdit);
			tableDeviceSources.appendChild(trDeviceSourceItem);
		}
	}
	divDeviceSources.appendChild(tableDeviceSources);
	let btnAddDeviceSource = document.createElement('button');
	btnAddDeviceSource.className = 'btn btn-dark mr-1';
	btnAddDeviceSource.innerHTML = 'Add Source';
	btnAddDeviceSource.setAttribute('onclick', 'Add_Device_Source(\'' + deviceId + '\');');
	divDeviceSources.appendChild(btnAddDeviceSource);
	$('#divContainer_DeviceFields')[0].style.display = 'none';
	$('#divContainer_DeviceSources')[0].style.display = 'block';
	$('#divContainer_DeviceSourceFields')[0].style.display = 'none';
	$('#divContainer_DeviceActions')[0].style.display = 'none';
	$('#divContainer_DeviceActionFields')[0].style.display = 'none';
	selectedDeviceId = deviceId;
	$("#modalDeviceSources").modal();
}

function Add_Device_Source(deviceId) {
	let divDeviceSourceFields = $('#divDeviceSourceFields')[0];
	divDeviceSourceFields.innerHTML = '';
    
    $(divDeviceSourceFields).append($('<select>',{
        id:'selDeviceSource',
        style:'display:block'
    }));
    $.each( sources.filter(src => src.enabled === true), function( key, source ) {
        $('#selDeviceSource').append($('<option>',{
            value:source.id,
            text:source.name
        }));
    });    
    $(divDeviceSourceFields).append($('<span>', {
        text: 'Select Address:'
    }));
    $(divDeviceSourceFields).append('<select id="addDeviceSourceAddressSelect" style="display:block;"></select>');
    $(divDeviceSourceFields).append($('<span>', {
        text: 'Or Enter Manually:'
    }));
    $(divDeviceSourceFields).append($('<input>', {
        id: 'txtAddDeviceSourceAddress',
        style: 'display:block;margin-bottom:5px;'
    }));
	$('#divContainer_DeviceSourceFields')[0].style.display = 'block';
	$('#btnAdd_DeviceSource_Save')[0].style.display = 'block';
	$('#btnEdit_DeviceSource_Save')[0].style.display = 'none';
	selectedDeviceId = deviceId;
    //Trigger a change of selDeviceSource to fetch up to date source list using the below event listener
    $('#selDeviceSource').change();
}
//Triggered when a new device source is selected, and when the modal is initially loaded by the Add_Device_Source method
$(document).on( "change", '#selDeviceSource',function(){
    $('#addDeviceSourceAddressSelect').empty().append($('<option>'));
    $.getJSON( "/settings/source_tallydata/" + $('#selDeviceSource').find(":selected").val(), function( tallydata ) {
        $.each( tallydata, function( key, data ) {
            $('#addDeviceSourceAddressSelect').append($('<option>', {
                text: data.address
            }));
        });        
    });
});

function Add_Device_Source_Save() {
	let deviceSourceObj = {};
	deviceSourceObj.deviceId = selectedDeviceId;
	deviceSourceObj.sourceId = $('#selDeviceSource')[0].options[$('#selDeviceSource')[0].selectedIndex].value;
    //Prefer a manual address over a selected one
    if($('#txtAddDeviceSourceAddress').val().length > 0){
        deviceSourceObj.address = $('#txtAddDeviceSourceAddress').val();
    }else{
        deviceSourceObj.address = $('#addDeviceSourceAddressSelect').find(":selected").text();
    }
	let arbiterObj = {};
	arbiterObj.action = 'add';
	arbiterObj.type = 'device_source';
	arbiterObj.device_source = deviceSourceObj;
	socket.emit('manage', arbiterObj);
}

function Edit_Device_Source(deviceSourceId) {
	let deviceSourceObj = GetDeviceSourceById(deviceSourceId);
	let divDeviceSourceFields = $('#divDeviceSourceFields')[0];
	divDeviceSourceFields.innerHTML = '';
	let spanDeviceSourceIdName = document.createElement('span');
	spanDeviceSourceIdName.innerHTML = 'Device Source Id:';
	spanDeviceSourceIdName.style.display = 'block';
	divDeviceSourceFields.appendChild(spanDeviceSourceIdName);
	let txtDeviceSourceId = document.createElement('input');
	txtDeviceSourceId.type = 'text';
	txtDeviceSourceId.id = 'txtDeviceSourceId';
	txtDeviceSourceId.value = deviceSourceId;
	txtDeviceSourceId.style.display = 'block';
	txtDeviceSourceId.disabled = true;
	divDeviceSourceFields.appendChild(txtDeviceSourceId);
	let selDeviceSource = document.createElement('select');
	selDeviceSource.style.display = 'block';
	selDeviceSource.id = 'selDeviceSource';
	for (let i = 0; i < sources.length; i++) {
		if (sources[i].enabled === true) {
			let opt = sources[i];
			let el = document.createElement('option');
			el.textContent = opt.name;
			el.value = opt.id;
			if (opt.id === deviceSourceId) {
				el.selected = true;
			}
			selDeviceSource.appendChild(el);
		}
	}
	divDeviceSourceFields.appendChild(selDeviceSource);
	let txtDeviceSourceAddress = document.createElement('input');
	txtDeviceSourceAddress.type = 'text';
	txtDeviceSourceAddress.id = 'txtDeviceSourceAddress';
	txtDeviceSourceAddress.value = deviceSourceObj.address;
	txtDeviceSourceAddress.style.display = 'block';
	txtDeviceSourceAddress.value = deviceSourceObj.address;
	divDeviceSourceFields.appendChild(txtDeviceSourceAddress);
	$('#divContainer_DeviceSourceFields')[0].style.display = 'block';
	$('#btnAdd_DeviceSource_Save')[0].style.display = 'none';
	$('#btnEdit_DeviceSource_Save')[0].style.display = 'block';
}

function Edit_Device_Source_Save() {
	let deviceSourceObj = {};
	deviceSourceObj.id = $('#txtDeviceSourceId')[0].value;
	deviceSourceObj.sourceId = $('#selDeviceSource')[0].options[$('#selDeviceSource')[0].selectedIndex].value;
	deviceSourceObj.address = $('#txtDeviceSourceAddress')[0].value;
	let arbiterObj = {};
	arbiterObj.action = 'edit';
	arbiterObj.type = 'device_source';
	arbiterObj.device_source = deviceSourceObj;
	console.log(arbiterObj);
	socket.emit('manage', arbiterObj);
}

function Cancel_Device_Source() {
	$('#divContainer_DeviceSourceFields')[0].style.display = 'none';
}

function Delete_Device_Source(deviceSourceId) {
	let result = confirm('Are you sure you want to delete this device source mapping?');
	if (!result) {
		return false;
	}
	let arbiterObj = {};
	arbiterObj.action = 'delete';
	arbiterObj.type = 'device_source';
	arbiterObj.device_source = {};
	arbiterObj.device_source.id = deviceSourceId;
	socket.emit('manage', arbiterObj);
}

function Close_Device_Sources() {
	$('#divContainer_DeviceSources')[0].style.display = 'none';
}

function Edit_Device_Actions(deviceId) {
	let divDeviceActions = $('#divDeviceActions')[0];
	divDeviceActions.innerHTML = '';
	$('#divDeviceActions_DeviceName')[0].innerHTML = GetDeviceById(deviceId).name;
	let tableDeviceActions = document.createElement('table');
	let trHeader = document.createElement('tr');
	let tdHeaderDeviceActionBus = document.createElement('td');
	tdHeaderDeviceActionBus.innerHTML = '<b>Bus</b>';
	trHeader.appendChild(tdHeaderDeviceActionBus);
	let tdHeaderDeviceActionActive = document.createElement('td');
	tdHeaderDeviceActionActive.innerHTML = '<b>On/Off</b>';
	trHeader.appendChild(tdHeaderDeviceActionActive);
	let tdHeaderDeviceActionOutputType = document.createElement('td');
	tdHeaderDeviceActionOutputType.innerHTML = '<b>Output Type</b>';
	trHeader.appendChild(tdHeaderDeviceActionOutputType);
	let tdHeaderDeviceActionsEdit = document.createElement('td');
	tdHeaderDeviceActionsEdit.innerHTML = '&nbsp;';
	trHeader.appendChild(tdHeaderDeviceActionsEdit);
	tableDeviceActions.appendChild(trHeader);
	for (let i = 0; i < device_actions.length; i++) {
		if (device_actions[i].deviceId === deviceId) {
			let trDeviceActionItem = document.createElement('tr');
			let tdDeviceActionBus = document.createElement('td');
			tdDeviceActionBus.innerHTML = getBusById(device_actions[i].busId).label;
			trDeviceActionItem.appendChild(tdDeviceActionBus);
			let tdDeviceActionActive = document.createElement('td');
			tdDeviceActionActive.innerHTML = ((device_actions[i].active === true) ? 'On' : 'Off')
			trDeviceActionItem.appendChild(tdDeviceActionActive);
			let tdDeviceActionOutputType = document.createElement('td');
			tdDeviceActionOutputType.innerHTML = GetOutputTypeById(device_actions[i].outputTypeId).label;
			trDeviceActionItem.appendChild(tdDeviceActionOutputType);
			let tdDeviceActionEdit = document.createElement('td');
			let btnEditDeviceAction = document.createElement('button');
			btnEditDeviceAction.className = 'btn btn-dark mr-1';
			btnEditDeviceAction.innerHTML = 'Edit';
			btnEditDeviceAction.setAttribute('onclick', 'Edit_Device_Action(\'' + device_actions[i].id + '\');');
			tdDeviceActionEdit.appendChild(btnEditDeviceAction);
			let btnDeleteDeviceAction = document.createElement('button');
			btnDeleteDeviceAction.className = 'btn btn-dark mr-1';
			btnDeleteDeviceAction.innerHTML = 'Delete';
			btnDeleteDeviceAction.setAttribute('onclick', 'Delete_Device_Action(\'' + device_actions[i].id + '\');');
			tdDeviceActionEdit.appendChild(btnDeleteDeviceAction);
			trDeviceActionItem.appendChild(tdDeviceActionEdit);
			tableDeviceActions.appendChild(trDeviceActionItem);
		}
	}
	divDeviceActions.appendChild(tableDeviceActions);
	let btnAddDeviceAction = document.createElement('button');
	btnAddDeviceAction.className = 'btn btn-dark mr-1';
	btnAddDeviceAction.innerHTML = 'Add Action';
	btnAddDeviceAction.setAttribute('onclick', 'Add_Device_Action(\'' + deviceId + '\');');
	divDeviceActions.appendChild(btnAddDeviceAction);
	$('#divContainer_DeviceFields')[0].style.display = 'none';
	$('#divContainer_DeviceSources')[0].style.display = 'none';
	$('#divContainer_DeviceSourceFields')[0].style.display = 'none';
	$('#divContainer_DeviceActions')[0].style.display = 'block';
	$('#divContainer_DeviceActionFields')[0].style.display = 'none';
	selectedDeviceId = deviceId;
	$("#modalDeviceActions").modal();
}

function Add_Device_Action(deviceId) {
	let divDeviceActionFields = $('#divDeviceActionFields')[0];
	divDeviceActionFields.innerHTML = '';
	let selDeviceAction_Bus = $('#selDeviceAction_Bus')[0];
	selDeviceAction_Bus.style.display = 'block';
	selDeviceAction_Bus.options.length = 0;
	for (let i = 0; i < bus_options.length; i++) {
		let opt = bus_options[i];
		let el = document.createElement('option');
		el.textContent = opt.label;
		el.value = opt.id;
		selDeviceAction_Bus.appendChild(el);
	}
	let selDeviceAction_OutputType = $('#selDeviceAction_OutputType')[0];
	selDeviceAction_OutputType.setAttribute('onchange', 'Add_Device_Action_ShowFields();');
	selDeviceAction_OutputType.style.display = 'block';
	selDeviceAction_OutputType.options.length = 0;
	let elChoose = document.createElement('option');
	elChoose.text = '(Choose Output Type)';
	elChoose.value = '-1';
	selDeviceAction_OutputType.appendChild(elChoose);
		for (let i = 0; i < output_types.length; i++) {
			if (output_types[i].enabled === true) {
				let opt = output_types[i];
				let el = document.createElement('option');
				el.textContent = opt.label;
				el.value = opt.id;
				selDeviceAction_OutputType.appendChild(el);
			}
		}
	$('#divContainer_DeviceActionFields')[0].style.display = 'block';
	$('#divDeviceActionDropdowns')[0].style.display = 'block';
	$('#btnAdd_DeviceAction_Save')[0].style.display = 'block';
	$('#btnEdit_DeviceAction_Save')[0].style.display = 'none';
	selectedDeviceId = deviceId;
}

function Add_Device_Action_ShowFields() {
	let divDeviceActionFields = $('#divDeviceActionFields')[0];
	divDeviceActionFields.innerHTML = '';
	let selDeviceAction_OutputType = $('#selDeviceAction_OutputType')[0];
	let selectedOutputTypeId = selDeviceAction_OutputType.options[selDeviceAction_OutputType.selectedIndex].value;
	if (selectedOutputTypeId === '-1') {
		alert('Invalid Output Type selected.');
		return false;
	}
	let fields = output_types_datafields.find(({outputTypeId}) => outputTypeId === selectedOutputTypeId).fields;
	for (let i = 0; i < fields.length; i++) {
		let spanFieldName = document.createElement('span');
		spanFieldName.innerHTML = fields[i].fieldLabel;
		spanFieldName.style.display = 'block';
		divDeviceActionFields.appendChild(spanFieldName);
		switch (fields[i].fieldType) {
			case 'text':
				let txtInput = document.createElement('input');
				txtInput.type = 'text';
				txtInput.id = 'field_DeviceAction_' + fields[i].fieldName;
				divDeviceActionFields.appendChild(txtInput);
				break;
			case 'number':
				let txtInputNumber = document.createElement('input');
				txtInputNumber.type = 'text';
				txtInputNumber.id = 'field_DeviceAction_' + fields[i].fieldName;
				divDeviceActionFields.appendChild(txtInputNumber);
				break;
			case 'port':
				let txtInputPort = document.createElement('input');
				txtInputPort.type = 'text';
				txtInputPort.id = 'field_DeviceAction_' + fields[i].fieldName;
				divDeviceActionFields.appendChild(txtInputPort);
				break;
			case 'dropdown':
				let selDropdown = document.createElement('select');
				selDropdown.id = 'field_DeviceAction_' + fields[i].fieldName;
				for (let j = 0; j < fields[i].options.length; j++) {
				let elOption = document.createElement('option');
				elOption.textContent = fields[i].options[j].label;
				elOption.value = fields[i].options[j].id;
				selDropdown.appendChild(elOption);
				}
				divDeviceActionFields.appendChild(selDropdown);
				break;
			case 'info':
				let spanInfo = document.createElement('span');
				spanInfo.id = fields[i].fieldName;
				spanInfo.innerHTML = fields[i].text;
				divDeviceActionFields.appendChild(spanInfo);
				break;
			case 'bool':
				let chkBool = document.createElement('input');
				chkBool.type = 'checkbox';
				chkBool.id = 'field_DeviceAction_' + fields[i].fieldName;
				divDeviceActionFields.appendChild(chkBool);
				break;
			default:
				break;
		}
	}
}

function Add_Device_Action_Save() {
	let deviceActionObj = {};
	deviceActionObj.deviceId = selectedDeviceId;
	deviceActionObj.busId = $('#selDeviceAction_Bus')[0].options[$('#selDeviceAction_Bus')[0].selectedIndex].value;
	deviceActionObj.active = (($('#selDeviceAction_BusActive')[0].options[$('#selDeviceAction_BusActive')[0].selectedIndex].value === 'on') ? true : false);
	deviceActionObj.outputTypeId = $('#selDeviceAction_OutputType')[0].options[$('#selDeviceAction_OutputType')[0].selectedIndex].value;
	if (deviceActionObj.outputTypeId === '-1') {
		alert('Invalid Output Type selected.');
		return false;
	}
	let dataObj = {};
	let fields = output_types_datafields.find(({outputTypeId}) => outputTypeId === deviceActionObj.outputTypeId).fields;
	for (let i = 0; i < fields.length; i++) {
		switch (fields[i].fieldType) {
			case 'text':
				dataObj[fields[i].fieldName] = $('#field_DeviceAction_' + fields[i].fieldName)[0].value;
				break;
			case 'number':
				dataObj[fields[i].fieldName] = $('#field_DeviceAction_' + fields[i].fieldName)[0].value;
				break;
			case 'port':
				dataObj[fields[i].fieldName] = $('#field_DeviceAction_' + fields[i].fieldName)[0].value;
				break;
			case 'dropdown':
				dataObj[fields[i].fieldName] = $('#field_DeviceAction_' + fields[i].fieldName)[0].options[$('#field_DeviceAction_' + fields[i].fieldName)[0].selectedIndex].value;
				break;
			case 'bool':
				dataObj[fields[i].fieldName] = $('#field_DeviceAction_' + fields[i].fieldName)[0].checked;
				break;
			default:
				break;
			}
	}
	deviceActionObj.data = dataObj;
	let arbiterObj = {};
	arbiterObj.action = 'add';
	arbiterObj.type = 'device_action';
	arbiterObj.device_action = deviceActionObj;
	socket.emit('manage', arbiterObj);
}

function Edit_Device_Action(deviceActionId) {
	let deviceActionObj = GetDeviceActionById(deviceActionId);
	let divDeviceActionFields = $('#divDeviceActionFields')[0];
	divDeviceActionFields.innerHTML = '';
	let spanDeviceActionIdName = document.createElement('span');
	spanDeviceActionIdName.innerHTML = 'Device Action Id:';
	spanDeviceActionIdName.style.display = 'block';
	divDeviceActionFields.appendChild(spanDeviceActionIdName);
	let txtDeviceActionId = document.createElement('input');
	txtDeviceActionId.type = 'text';
	txtDeviceActionId.id = 'txtDeviceActionId';
	txtDeviceActionId.value = deviceActionId;
	txtDeviceActionId.style.display = 'block';
	txtDeviceActionId.disabled = true;
	divDeviceActionFields.appendChild(txtDeviceActionId);
	$('#divDeviceActionDropdowns')[0].style.display = 'none';
	let spanDeviceActionBus = document.createElement('span');
	spanDeviceActionBus.innerHTML = 'Bus: ' + getBusById(deviceActionObj.busId).label;
	spanDeviceActionBus.style.display = 'block';
	divDeviceActionFields.appendChild(spanDeviceActionBus);
	let spanDeviceActionBusActive = document.createElement('span');
	spanDeviceActionBusActive.innerHTML = 'Active: ' + ((deviceActionObj.active === true) ? 'On' : 'Off');
	spanDeviceActionBusActive.style.display = 'block';
	divDeviceActionFields.appendChild(spanDeviceActionBusActive);
	let spanDeviceActionOutputType = document.createElement('span');
	spanDeviceActionOutputType.innerHTML = 'Output Type: ' + GetOutputTypeById(deviceActionObj.outputTypeId).label;
	spanDeviceActionOutputType.style.display = 'block';
	divDeviceActionFields.appendChild(spanDeviceActionOutputType);
	let fields = output_types_datafields.find(({outputTypeId}) => outputTypeId === deviceActionObj.outputTypeId).fields;
	for (let i = 0; i < fields.length; i++) {
		let spanFieldName = document.createElement('span');
		spanFieldName.innerHTML = fields[i].fieldLabel;
		spanFieldName.style.display = 'block';
		divDeviceActionFields.appendChild(spanFieldName);
		switch (fields[i].fieldType) {
			case 'text':
				let txtInput = document.createElement('input');
				txtInput.type = 'text';
				txtInput.id = 'field_DeviceAction_' + fields[i].fieldName;
				txtInput.value = deviceActionObj.data[fields[i].fieldName];
				divDeviceActionFields.appendChild(txtInput);
				break;
			case 'number':
				let txtInputNumber = document.createElement('input');
				txtInputNumber.type = 'text';
				txtInputNumber.id = 'field_DeviceAction_' + fields[i].fieldName;
				txtInputNumber.value = deviceActionObj.data[fields[i].fieldName];
				divDeviceActionFields.appendChild(txtInputNumber);
				break;
			case 'port':
				let txtInputPort = document.createElement('input');
				txtInputPort.type = 'text';
				txtInputPort.id = 'field_DeviceAction_' + fields[i].fieldName;
				txtInputPort.value = deviceActionObj.data[fields[i].fieldName];
				divDeviceActionFields.appendChild(txtInputPort);
				break;
			case 'dropdown':
				let selDropdown = document.createElement('select');
				selDropdown.id = 'field_DeviceAction_' + fields[i].fieldName;
				for (let j = 0; j < fields[i].options.length; j++) {
				let elOption = document.createElement('option');
				elOption.textContent = fields[i].options[j].label;
				elOption.value = fields[i].options[j].id;
				if (deviceActionObj.data[fields[i].fieldName] === fields[i].options[j].id) {
					elOption.selected = true;
				}
				selDropdown.appendChild(elOption);
				}
				divDeviceActionFields.appendChild(selDropdown);
				break;
			case 'info':
				let spanInfo = document.createElement('span');
				spanInfo.id = fields[i].fieldName;
				spanInfo.innerHTML = fields[i].text;
				divDeviceActionFields.appendChild(spanInfo);
				break;
			case 'bool':
				let chkBool = document.createElement('input');
				chkBool.type = 'checkbox';
				chkBool.id = 'field_DeviceAction_' + fields[i].fieldName;
				chkBool.checked = ((deviceActionObj.data[fields[i].fieldName] === true) ? true : false);
				divDeviceActionFields.appendChild(chkBool);
				break;
			default:
				break;
		}
	}
	$('#divContainer_DeviceActionFields')[0].style.display = 'block';
	$('#btnAdd_DeviceAction_Save')[0].style.display = 'none';
	$('#btnEdit_DeviceAction_Save')[0].style.display = 'block';
}

function Edit_Device_Action_Save() {
	let existingDeviceActionObj = GetDeviceActionById($('#txtDeviceActionId')[0].value);
	let deviceActionObj = {};
	deviceActionObj.id = existingDeviceActionObj.id;
	deviceActionObj.deviceId = existingDeviceActionObj.deviceId;
	deviceActionObj.busId = existingDeviceActionObj.busId;
	deviceActionObj.active = existingDeviceActionObj.active;
	deviceActionObj.outputTypeId = existingDeviceActionObj.outputTypeId;
	let dataObj = {};
	let fields = output_types_datafields.find(({outputTypeId}) => outputTypeId === deviceActionObj.outputTypeId).fields;
	for (let i = 0; i < fields.length; i++) {
		switch (fields[i].fieldType) {
		case 'text':
			dataObj[fields[i].fieldName] = $('#field_DeviceAction_' + fields[i].fieldName)[0].value;
			break;
		case 'number':
			dataObj[fields[i].fieldName] = $('#field_DeviceAction_' + fields[i].fieldName)[0].value;
			break;
		case 'port':
			dataObj[fields[i].fieldName] = $('#field_DeviceAction_' + fields[i].fieldName)[0].value;
			break;
		case 'dropdown':
			dataObj[fields[i].fieldName] = $('#field_DeviceAction_' + fields[i].fieldName)[0].options[$('#field_DeviceAction_' + fields[i].fieldName)[0].selectedIndex].value;
			break;
		case 'bool':
			dataObj[fields[i].fieldName] = $('#field_DeviceAction_' + fields[i].fieldName)[0].checked;
			break;
		default:
			break;
		}
	}
	deviceActionObj.data = dataObj;
	let arbiterObj = {};
	arbiterObj.action = 'edit';
	arbiterObj.type = 'device_action';
	arbiterObj.device_action = deviceActionObj;
	socket.emit('manage', arbiterObj);
}

function Cancel_Device_Action() {
	$('#divContainer_DeviceActionFields')[0].style.display = 'none';
}

function Delete_Device_Action(deviceActionId) {
	let result = confirm('Are you sure you want to delete this action?');
	if (!result) {
		return false;
	}
	let arbiterObj = {};
	arbiterObj.action = 'delete';
	arbiterObj.type = 'device_action';
	arbiterObj.device_action = {};
	arbiterObj.device_action.id = deviceActionId;
	socket.emit('manage', arbiterObj);
}

function Close_Device_Actions() {
	$('#divContainer_DeviceActions')[0].style.display = 'none';
}

function Add_TSL_Client() {
	$('#divContainer_TSLClientFields')[0].style.display = 'block';
	let divTSLClientFields = $('#divTSLClientFields')[0];
	divTSLClientFields.innerHTML = '';
	let spanTSLIP = document.createElement('span');
	spanTSLIP.innerHTML = 'IP Address';
	spanTSLIP.style.display = 'block';
	divTSLClientFields.appendChild(spanTSLIP);
	let txtTSLIP = document.createElement('input');
	txtTSLIP.type = 'text';
	txtTSLIP.id = 'txtTSLIP';
	txtTSLIP.style.display = 'block';
	divTSLClientFields.appendChild(txtTSLIP);
	let spanTSLPort = document.createElement('span');
	spanTSLPort.innerHTML = 'Port';
	spanTSLPort.style.display = 'block';
	divTSLClientFields.appendChild(spanTSLPort);
	let txtTSLPort = document.createElement('input');
	txtTSLPort.type = 'text';
	txtTSLPort.id = 'txtTSLPort';
	txtTSLPort.style.display = 'block';
	divTSLClientFields.appendChild(txtTSLPort);
	let selTSLTransport = document.createElement('select');
	selTSLTransport.style.display = 'block';
	selTSLTransport.id = 'selTSLTransport';
	let optUDP = document.createElement('option');
	optUDP.textContent = 'UDP';
	optUDP.value = 'udp';
	selTSLTransport.appendChild(optUDP);
	let optTCP = document.createElement('option');
	optTCP.textContent = 'TCP';
	optTCP.value = 'tcp';
	selTSLTransport.appendChild(optTCP);
	divTSLClientFields.appendChild(selTSLTransport);
	$('#btnAdd_TSL_Client_Save')[0].style.display = 'block';
	$('#btnEdit_TSL_Client_Save')[0].style.display = 'none';
	$("#modalTSLClient").modal();
}

function Add_TSL_Client_Save() {
	let tslClientObj = {};
	tslClientObj.ip = $('#txtTSLIP')[0].value;
	tslClientObj.port = $('#txtTSLPort')[0].value;
	tslClientObj.transport = $('#selTSLTransport')[0].options[$('#selTSLTransport')[0].selectedIndex].value;
	let arbiterObj = {};
	arbiterObj.action = 'add';
	arbiterObj.type = 'tsl_client';
	arbiterObj.tslClient = tslClientObj;
	socket.emit('manage', arbiterObj);
}

function Edit_TSL_Client(tslClientId) {
	let divTSLClientFields = $('#divTSLClientFields')[0];
	divTSLClientFields.innerHTML = '';
	let tslClient = GetTSLClientById(tslClientId);
	let spanTSLClientId = document.createElement('span');
	spanTSLClientId.innerHTML = 'TSL Client Id:';
	spanTSLClientId.style.display = 'block';
	divTSLClientFields.appendChild(spanTSLClientId);
	let txtTSLClientId = document.createElement('input');
	txtTSLClientId.type = 'text';
	txtTSLClientId.id = 'txtTSLClientId';
	txtTSLClientId.value = tslClientId;
	txtTSLClientId.style.display = 'block';
	txtTSLClientId.disabled = true;
	divTSLClientFields.appendChild(txtTSLClientId);
	let spanTSLIP = document.createElement('span');
	spanTSLIP.innerHTML = 'IP Address';
	spanTSLIP.style.display = 'block';
	divTSLClientFields.appendChild(spanTSLIP);
	let txtTSLIP = document.createElement('input');
	txtTSLIP.type = 'text';
	txtTSLIP.id = 'txtTSLIP';
	txtTSLIP.value = tslClient.ip;
	txtTSLIP.style.display = 'block';
	divTSLClientFields.appendChild(txtTSLIP);
	let spanTSLPort = document.createElement('span');
	spanTSLPort.innerHTML = 'Port';
	spanTSLPort.style.display = 'block';
	divTSLClientFields.appendChild(spanTSLPort);
	let txtTSLPort = document.createElement('input');
	txtTSLPort.type = 'text';
	txtTSLPort.id = 'txtTSLPort';
	txtTSLPort.value = tslClient.port;
	txtTSLPort.style.display = 'block';
	divTSLClientFields.appendChild(txtTSLPort);
	let selTSLTransport = document.createElement('select');
	selTSLTransport.style.display = 'block';
	selTSLTransport.id = 'selTSLTransport';
	let optUDP = document.createElement('option');
	optUDP.textContent = 'UDP';
	optUDP.value = 'udp';
	if (tslClient.transport === 'udp') {
		optUDP.selected = true;
	}
	selTSLTransport.appendChild(optUDP);
	let optTCP = document.createElement('option');
	optTCP.textContent = 'TCP';
	optTCP.value = 'tcp';
	if (tslClient.transport === 'tcp') {
		optTCP.selected = true;
	}
	selTSLTransport.appendChild(optTCP);
	divTSLClientFields.appendChild(selTSLTransport);
	let btnAdd_TSLClient_Save = $('#btnAdd_TSL_Client_Save')[0];
	btnAdd_TSLClient_Save.style.display = 'none';
	let btnEdit_TSLClient_Save = $('#btnEdit_TSL_Client_Save')[0];
	btnEdit_TSLClient_Save.style.display = 'block';
	$('#divContainer_TSLClientFields')[0].style.display = 'block';
	selectedTSLClientId = tslClientId;
	$("#modalTSLClient").modal();
}

function Edit_TSL_Client_Save() {
	let tslClientObj = {};
	tslClientObj.id = selectedTSLClientId;
	tslClientObj.ip = $('#txtTSLIP')[0].value;
	tslClientObj.port = $('#txtTSLPort')[0].value;
	tslClientObj.transport = $('#selTSLTransport')[0].options[$('#selTSLTransport')[0].selectedIndex].value;
	let arbiterObj = {};
	arbiterObj.action = 'edit';
	arbiterObj.type = 'tsl_client';
	arbiterObj.tslClient = tslClientObj;
	socket.emit('manage', arbiterObj);
}

function Cancel_TSL_Client() {
	$('#divContainer_TSLClientFields')[0].style.display = 'none';
}

function Delete_TSL_Client(tslClientId) {
	let arbiterObj = {};
	arbiterObj.action = 'delete';
	arbiterObj.type = 'tsl_client';
	arbiterObj.tslClientId = tslClientId;
	socket.emit('manage', arbiterObj);
}

function Add_Cloud_Destination() {
	$('#divContainer_CloudDestinationFields')[0].style.display = 'block';
	let divCloudDestinationFields = $('#divCloudDestinationFields')[0];
	divCloudDestinationFields.innerHTML = '';
	let spanIP = document.createElement('span');
	spanIP.innerHTML = 'Host Address';
	spanIP.style.display = 'block';
	divCloudDestinationFields.appendChild(spanIP);
	let txtIP = document.createElement('input');
	txtIP.type = 'text';
	txtIP.id = 'txtCloudDestinationHost';
	txtIP.style.display = 'block';
	divCloudDestinationFields.appendChild(txtIP);
	let spanPort = document.createElement('span');
	spanPort.innerHTML = 'Port';
	spanPort.style.display = 'block';
	divCloudDestinationFields.appendChild(spanPort);
	let txtPort = document.createElement('input');
	txtPort.type = 'text';
	txtPort.id = 'txtCloudDestinationPort';
	txtPort.value = '4455';
	txtPort.style.display = 'block';
	divCloudDestinationFields.appendChild(txtPort);
	let spanKey = document.createElement('span');
	spanKey.innerHTML = 'Key';
	spanKey.style.display = 'block';
	divCloudDestinationFields.appendChild(spanKey);
	let txtKey = document.createElement('input');
	txtKey.type = 'text';
	txtKey.id = 'txtCloudDestinationKey';
	txtKey.style.display = 'block';
	divCloudDestinationFields.appendChild(txtKey);
	$('#btnAdd_Cloud_Destination_Save')[0].style.display = 'block';
	$('#btnEdit_Cloud_Destination_Save')[0].style.display = 'none';
	$("#modalCloudDestination").modal();
}

function Add_Cloud_Destination_Save() {
	let cloudObj = {};
	cloudObj.host = $('#txtCloudDestinationHost')[0].value;
	cloudObj.port = $('#txtCloudDestinationPort')[0].value;
	cloudObj.key = $('#txtCloudDestinationKey')[0].value;
	let arbiterObj = {};
	arbiterObj.action = 'add';
	arbiterObj.type = 'cloud_destination';
	arbiterObj.cloudDestination = cloudObj;
	socket.emit('manage', arbiterObj);
}

function Edit_Cloud_Destination(cloudId) {
	let divCloudDestinationFields = $('#divCloudDestinationFields')[0];
	divCloudDestinationFields.innerHTML = '';
	let cloudObj = GetCloudDestinationById(cloudId);
	let spanCloudId = document.createElement('span');
	spanCloudId.innerHTML = 'Cloud Destination Id:';
	spanCloudId.style.display = 'block';
	divCloudDestinationFields.appendChild(spanCloudId);
	let txtCloudId = document.createElement('input');
	txtCloudId.type = 'text';
	txtCloudId.id = 'txtCloudId';
	txtCloudId.value = cloudId;
	txtCloudId.style.display = 'block';
	txtCloudId.disabled = true;
	divCloudDestinationFields.appendChild(txtCloudId);
	let spanIP = document.createElement('span');
	spanIP.innerHTML = 'Host';
	spanIP.style.display = 'block';
	divCloudDestinationFields.appendChild(spanIP);
	let txtIP = document.createElement('input');
	txtIP.type = 'text';
	txtIP.id = 'txtCloudDestinationHost';
	txtIP.value = cloudObj.host;
	txtIP.style.display = 'block';
	divCloudDestinationFields.appendChild(txtIP);
	let spanPort = document.createElement('span');
	spanPort.innerHTML = 'Port';
	spanPort.style.display = 'block';
	divCloudDestinationFields.appendChild(spanPort);
	let txtPort = document.createElement('input');
	txtPort.type = 'text';
	txtPort.id = 'txtCloudDestinationPort';
	txtPort.value = cloudObj.port;
	txtPort.style.display = 'block';
	divCloudDestinationFields.appendChild(txtPort);
	let spanKey = document.createElement('span');
	spanKey.innerHTML = 'Key';
	spanKey.style.display = 'block';
	divCloudDestinationFields.appendChild(spanKey);
	let txtKey = document.createElement('input');
	txtKey.type = 'text';
	txtKey.id = 'txtCloudDestinationKey';
	txtKey.value = cloudObj.key;
	txtKey.style.display = 'block';
	divCloudDestinationFields.appendChild(txtKey);
	let btnAdd_TSLClient_Save = $('#btnAdd_Cloud_Destination_Save')[0];
	btnAdd_TSLClient_Save.style.display = 'none';
	let btnEdit_TSLClient_Save = $('#btnEdit_Cloud_Destination_Save')[0];
	btnEdit_TSLClient_Save.style.display = 'block';
	$('#divContainer_CloudDestinationFields')[0].style.display = 'block';
	selectedCloudId = cloudId;
	$("#modalCloudDestination").modal();
}

function Edit_Cloud_Destination_Save() {
	let cloudObj = {};
	cloudObj.id = selectedCloudId;
	cloudObj.host = $('#txtCloudDestinationHost')[0].value;
	cloudObj.port = $('#txtCloudDestinationPort')[0].value;
	cloudObj.key = $('#txtCloudDestinationKey')[0].value;
	let arbiterObj = {};
	arbiterObj.action = 'edit';
	arbiterObj.type = 'cloud_destination';
	arbiterObj.cloudDestination = cloudObj;
	socket.emit('manage', arbiterObj);
}

function Cancel_Cloud_Destination() {
	$('#divContainer_CloudDestinationFields')[0].style.display = 'none';
}

function Delete_Cloud_Destination(cloudId) {
	let arbiterObj = {};
	arbiterObj.action = 'delete';
	arbiterObj.type = 'cloud_destination';
	arbiterObj.cloudId = cloudId;
	socket.emit('manage', arbiterObj);
}

function Reconnect_Cloud_Destination(cloudDestinationId) {
	socket.emit('cloud_destination_reconnect', cloudDestinationId);
}

function Disconnect_Cloud_Destination(cloudDestinationId) {
	socket.emit('cloud_destination_disconnect', cloudDestinationId);
}

function Add_Cloud_Key() {
	$('#divContainer_CloudKeyFields')[0].style.display = 'block';
	let divCloudKeyFields = $('#divCloudKeyFields')[0];
	divCloudKeyFields.innerHTML = '';
	let spanKey = document.createElement('span');
	spanKey.innerHTML = 'Key';
	spanKey.style.display = 'block';
	divCloudKeyFields.appendChild(spanKey);
	let txtKey = document.createElement('input');
	txtKey.type = 'text';
	txtKey.id = 'txtCloudKey';
	txtKey.style.display = 'block';
	divCloudKeyFields.appendChild(txtKey);
	$('#btnAdd_Cloud_Key_Save')[0].style.display = 'block';
	$("#modalCloudKey").modal();
}

function Add_Cloud_Key_Save() {
	let arbiterObj = {};
	arbiterObj.action = 'add';
	arbiterObj.type = 'cloud_key';
	arbiterObj.key = $('#txtCloudKey')[0].value;
	socket.emit('manage', arbiterObj);
}

function Cancel_Cloud_Key() {
	$('#divContainer_CloudKeyFields')[0].style.display = 'none';
}

function Delete_Cloud_Key(key) {
	if (confirm('If you delete this key, all connected cloud clients using this key will be disconnected. Are you sure you want to delete it?')) {
		let arbiterObj = {};
		arbiterObj.action = 'delete';
		arbiterObj.type = 'cloud_key';
		arbiterObj.key = key;
		socket.emit('manage', arbiterObj);
	}
}

function Remove_Cloud_Client(id) {
	let arbiterObj = {};
	arbiterObj.action = 'remove';
	arbiterObj.type = 'cloud_client';
	arbiterObj.id = id;

	socket.emit('manage', arbiterObj);
}

function CheckPort(port, sourceId) {
	let portFound = false;
	for (let i = 0; i < PortsInUse.length; i++) {
		if (PortsInUse[i].port === port.toString()) {
			if (PortsInUse[i].sourceId === sourceId) {
				//this source owns this port, it's ok
				return true;
			}
			else {
				//this source doesn't own this port
				return false;
			}
			break;
		}
	}
	if (portFound === false) {
		//the port isn't in use, it's ok
		return true;
	}
}

function GettingStarted_Close() {
	$('#gettingStarted')[0].style.display = 'block';
}
