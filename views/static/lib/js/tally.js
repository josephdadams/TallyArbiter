var socket = null;
var Devices = [];
var selectedDeviceId = null;
var noSleep = new NoSleep();
var KeepAwake = true;
var device_states = [];
var mode_preview = false;
var mode_program = false;

window.onload = onLoad;

function onLoad() {
	socket = io.connect();
	socket.on('connect', function () {
		//connected, let's get some data
		socket.emit('devices');
		socket.emit('bus_options');
	});
	socket.on('devices', function (deviceArray) {
		//Returns a list of available Devices for the dropdown list
		Devices = deviceArray;
		updateDeviceList();
	});
	socket.on('bus_options', function (busOptionsArray) {
		//Returns a list of available bus options (preview, program, etc.)
		Bus_Options = busOptionsArray;
	});
	socket.on('device_states', function (tallyDataArray) {
		//process the data received and determine if it's in preview or program and color the screen accordingly
		device_states = tallyDataArray;
		ProcessTallyData();
	});
	socket.on('flash', function () {
		//flashes the screen to get the user's attention
		document.body.className = 'flash';
		setTimeout(function () {
			document.body.classList.remove('flash');
		}, 500);
	});
	socket.on('reassign', function (oldDeviceId, deviceId) {
		//processes a reassign request that comes from the Settings GUI and relays the command so it originates from this socket
		socket.emit('listener_reassign', oldDeviceId, deviceId);
		selectedDeviceId = deviceId;
		updateTallyInfo();
	});
	socket.on('messaging', function(type, socketid, message) {
		insertChat(type, socketid, message);
	});
}

function updateDeviceList() {
	var selDeviceList = document.getElementById('selDeviceList');
	selDeviceList.options.length = 0;
	if (Devices.length > 1) { //build a dropdown list of available devices
		let optSelectOne = document.createElement('option');
		optSelectOne.value = '0';
		optSelectOne.text = '(select a Device)';
		selDeviceList.appendChild(optSelectOne);
		for (let i = 0; i < Devices.length; i++) {
			let opt = document.createElement('option');
			opt.value = Devices[i].id;
			opt.text = Devices[i].name;
			selDeviceList.appendChild(opt);
		}
		selDeviceList.setAttribute('onchange', 'selectDeviceFromList();');
		document.getElementById('tallyErrorMessage').style.display = 'none';
	}
	else if (Devices.length === 1) { // just load the only one available
		selectDevice(Devices[0].id);
		document.getElementById('tallyErrorMessage').style.display = 'none';
	}
	else {
		//no devices are available
		document.getElementById('tallyErrorMessage').style.display = 'block';
	}
}

function selectDeviceFromList() {
	let sel = document.getElementById('selDeviceList');
	let id = sel.options[sel.selectedIndex].value;
	if (id !== '0') {
		selectDevice(id);
	}
	KeepScreenAwake(true); //keeps the phone from falling asleep
}

function selectDevice(deviceId) {
	socket.emit('device_listen', deviceId, 'web');
	selectedDeviceId = deviceId;
	document.getElementById('selDeviceList').style.display = 'none';
	document.getElementById('divMessages').style.display = 'block';
	updateTallyInfo();
}

function getBusTypeById(busId) {
	//gets the bus type (preview/program) by the bus id
	let bus = Bus_Options.find(({id}) => id === busId);
	return bus.type;
}

function getDeviceById(deviceId) {
	//gets the device by the id
	let device = Devices.find(({id}) => id === deviceId);
	return device;
}

function ProcessTallyData() {
	for (let i = 0; i < device_states.length; i++) {
		if (getBusTypeById(device_states[i].busId) === 'preview') {
			if (device_states[i].sources.length > 0) {
				mode_preview = true;
			}
			else {
				mode_preview = false;
			}
		}
		else if (getBusTypeById(device_states[i].busId) === 'program') {
			if (device_states[i].sources.length > 0) {
				mode_program = true;
			}
			else {
				mode_program = false;
			}
		}
	}
	if ((mode_preview) && (!mode_program)) {
		//preview mode, color it green
		document.body.style.backgroundColor = '#00FF00';
	}
	else if ((!mode_preview) && (mode_program)) {
		//program mode, color it red
		document.body.style.backgroundColor = '#FF0000';
	}
	else if ((mode_preview) && (mode_program)) {
		//both, color it yellow
		document.body.style.backgroundColor = '#FFCC00';
	}
	else {
		document.body.style.backgroundColor = '#000000';
	}

	if (mode_program) {
		let successBool = window.navigator.vibrate(400);
	}
	else if (mode_preview) {
		let successBool = window.navigator.vibrate(100, 30, 100, 30, 100);
	}
}

function updateTallyInfo() {
	let deviceObj = getDeviceById(selectedDeviceId);
	let divTally = document.getElementById('divTally');
	let spanTitle = document.createElement('span');
	spanTitle.innerHTML = deviceObj.name;
	spanTitle.className = 'tallyDeviceTitle';
	let spanDescription = document.createElement('span');
	spanDescription.innerHTML = deviceObj.description;
	spanDescription.className = 'tallyDeviceDescription';
	divTally.innerHTML = '';
	divTally.appendChild(spanTitle);
	divTally.appendChild(spanDescription);
	divTally.style.display = 'block';
}

function KeepScreenAwake(value) { //keeps the phone screen on if true by using the NoSleep library - playing a dummy video in the background
	KeepAwake = value;
	if (value) {
		noSleep.enable();
	}
	else {
		noSleep.disable();
	}
}

//CHAT/MESSAGING
var chat_me = client;

$(document).ready(function () {
	$('#btnShowHideChat').click(function() {
		$(this).toggleClass("active");
		if ($(this).hasClass("active")) {
			$(this).text("Hide Chat");
		}
		else {
			$(this).text("Show Chat");
		}
	});
});