
/* Tally Arbiter: Source Type Ross Carbonite */
const EventEmitter = require('events');

class Ross_Carbonite extends EventEmitter {
    constructor(source) {
		super();
		this.sourceId = source.id;
		this.data = source.data;
	}

	start() {
		try {
			
		}
		catch (error) {
			this.emit('error', error);
		}
	}

	stop() {
		try {
			//closing stuff
		}
		catch (error) {
			this.emit('error', error);
		}
	}
}

module.exports = Ross_Carbonite;

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
