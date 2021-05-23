/* Tally Arbiter: Source Type Blackmagic VideoHub */
const EventEmitter = require('events');
const net = require('net');

var labels_VideoHub = []; //array of VideoHub source labels
var destinations_VideoHub = []; //array of VideoHub destination/source assignments
var tallydata_VideoHub = [];

class Blackmagic_VideoHub extends EventEmitter {
    constructor(source) {
		super();
		this.sourceId = source.id;
		this.data = source.data;
	}

	start() {
		let self = this;

		let ip = self.data.ip;
		let port = 9990;

		try {
			self.server = new net.Socket();

			self.receiveBuffer = '';
			self.command = null;
			self.stash = [];

			self.server.on('error', function(error) {
				self.emit('error', error);
			});

			self.server.on('connect', function() {
				self.emit('connection_state', true);
			});

			self.server.on('data', function(chunk) {
				let j = 0, line = '', offset = 0;
				self.receiveBuffer += chunk;

				while ( (j = self.receiveBuffer.indexOf('\n', offset)) !== -1) {
					line = self.receiveBuffer.substr(offset, j - offset);
					offset = j + 1;
					self.server.emit('receiveline', line.toString());
				}

				self.receiveBuffer = self.receiveBuffer.substr(offset);
			});

			self.server.on('receiveline', function(line) {
				if (self.command === null && line.match(/:/) ) {
					self.command = line;
				}
				else if (self.command !== null && line.length > 0) {
					self.stash.push(line.trim());
				}
				else if (line.length === 0 && self.command !== null) {
					let cmd = self.command.trim().split(/:/)[0];

					processVideohubInformation(cmd, self.stash);

					self.stash = [];
					self.command = null;
				}
			});

			self.server.on('close', function() {
				self.emit('connection_state', false);
			});

			self.server.connect(port, ip);			
		}
		catch (error) {
			self.emit('error', error);
		}
	}

	stop() {
		let self = this;
		try {
			//closing stuff
			self.server.end();
		}
		catch (error) {
			self.emit('error', error);
		}
	}

	getTallyData() {
		return tallydata_VideoHub;
	}
}

module.exports = Blackmagic_VideoHub;

function processVideohubInformation(cmd, stash) {
	if (cmd.match(/VIDEO OUTPUT ROUTING/)) {
		for (let i = 0; i < stash.length; i++) {
			let destination = parseInt(stash[i].substr(0, stash[i].indexOf(' ')));
			let source = parseInt(stash[i].substr(stash[i].indexOf(' ')));
			destination++; //zero-based so we increment it
			source++;//zero-based so we increment it
			processVideoHubTally(destination, source);
		}
	}
	else if (cmd.match(/INPUT LABELS/)) {
		for (let i = 0; i < stash.length; i++) {
			let source = parseInt(stash[i].substr(0, stash[i].indexOf(' ')));
			source++; //zero-based so we increment it
			let name = stash[i].substr(stash[i].indexOf(' '));
			addVideoHubInformation(source, name);
		}
	}
}

function addVideoHubInformation(source, name) {
	let found = false;
	for (let i = 0; i < labels_VideoHub.length; i++) {
		if (labels_VideoHub[i].source === source) {
			found = true;
			labels_VideoHub[i].name = name;
			break;
		}
	}

	if (!found) {
		let labelObj = {};
		labelObj.source = source;
		labelObj.name = name;
		labels_VideoHub.push(labelObj);
	}
}

function processVideoHubTally(destination, src) {
	//this builds the tallydata_Videohub array and makes sure it has an initial state
	let tallyFound = false;

	for (let i = 0; i < tallydata_VideoHub.length; i++) {
		if (tallydata_VideoHub[i].address === src) {
			tallyFound = true;
			break;
		}
	}

	if (!tallyFound) {
		let tallyObj = {};
		tallyObj.address = src;
		tallyObj.label = getVideoHubSourceName(src);
		tallydata_VideoHub.push(tallyObj);
	}

	updateVideoHubDestination(destination, src);
}

function updateVideoHubDestination(destination, src) {
	//maintains an array of videohub destinations and their active sources

	let found = false;

	let recheck_sources = [];

	//loop through and update the destinations array with the new source
	//if the source has changed, add the previous source to a new array to recheck the state of that source
	for (let i = 0; i < destinations_VideoHub.length; i++) {
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

	if (!found) {
		let destinationObj = {};
		destinationObj.destination = destination;
		destinationObj.source = src;
		destinations_VideoHub.push(destinationObj);
	}

	//check to see if any of the destinations currently have this source and if that destination is configured as a preview or program bus
	let inPreview = false;
	let inProgram = false;

	for (let i = 0; i < destinations_VideoHub.length; i++) {
		if (destinations_VideoHub[i].source === src) {
			if (self.data.destinations_pvw.includes(destinations_VideoHub[i].destination)) {
				inPreview = true;
			}
			if (self.data.destinations_pgm.includes(destinations_VideoHub[i].destination)) {
				inProgram = true;
			}
		}
	}

	for (let i = 0; i < tallydata_VideoHub.length; i++) {
		if (tallydata_VideoHub[i].address === src) {
			tallydata_VideoHub[i].tally1 = (inPreview ? 1 : 0);
			tallydata_VideoHub[i].tally2 = (inProgram ? 1 : 0);	
			self.emit('data', tallydata_VideoHub[i]);
		}
	}

	//now recheck any source that used to be in this destination and make sure they are not in pvw/pgm elsewhere
	for (let i = 0; i < recheck_sources.length; i++) {
		let inPreview = false;
		let inProgram = false;
		for (let j = 0; j < destinations_VideoHub.length; j++) {
			if (destinations_VideoHub[j].source === recheck_sources[i]) {
				//check and see if this destination is a pvw or pgm type
				if (self.data.destinations_pvw.includes(destinations_VideoHub[j].destination)) {
					inPreview = true;
				}
				if (self.data.destinations_pgm.includes(destinations_VideoHub[j].destination)) {
					inProgram = true;
				}
			}
		}

		for (let j = 0; j < tallydata_VideoHub.length; j++) {
			if (tallydata_VideoHub[j].address === recheck_sources[i]) {
				tallydata_VideoHub[j].tally1 = (inPreview ? 1 : 0);
				tallydata_VideoHub[j].tally2 = (inProgram ? 1 : 0);
				self.emit('data', tallydata_VideoHub[j]);
			}
		}
	}
}

function getVideoHubSourceName(source) {
	let returnVal = null;

	for (let i = 0; i < labels_VideoHub.length; i++) {
		if (labels_VideoHub[i].source === source) {
			returnVal = labels_VideoHub[i].name;
			break;
		}
	}

	return returnVal;
}