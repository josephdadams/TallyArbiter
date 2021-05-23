/* Tally Arbiter: Source Type Blackmagic ATEM */
const EventEmitter = require('events');
const { Atem } = require('atem-connection');

var tallydata_ATEM = [];

class Blackmagic_ATEM extends EventEmitter {
    constructor(source) {
		super();
		this.sourceId = source.id;
		this.data = source.data;
	}

	start() {
		let self = this;

		try {
			let atemIP = self.data.ip;

			source_connections[i].server = new Atem();

			source_connections[i].server.on('connected', () => {
				self.emit('connection_state', true);
			});

			source_connections[i].server.on('disconnected', () => {
				self.emit('connection_state', false);
			});
			
			source_connections[i].server.on('stateChanged', (state, path) => {
				for (let h = 0; h < path.length; h++) {
					if (path[h] === 'info.capabilities') {
						//console.log(state.info.capabilities);
					}
					else if ((path[h].indexOf('video.mixEffects') > -1) || (path[h].indexOf('video.ME') > -1)) {
						for (let i = 0; i < state.video.mixEffects.length; i++) {
							processATEMTally(state.video.mixEffects[i].index+1, state.video.mixEffects[i].programInput, state.video.mixEffects[i].previewInput);
						}
					}
				}
			});

			source_connections[i].server.on('info', console.log);
			source_connections[i].server.on('error', (error) => {
				self.emit('error', error);
			});

			source_connections[i].server.connect(atemIP);
			
		}
		catch (error) {
			self.emit('error', error);
		}
	}

	stop() {
		let self = this;
		try {
			//closing stuff
			self.server.disconnect(null);
		}
		catch (error) {
			self.emit('error', error);
		}
	}

	getTallyData() {
		return tallydata_ATEM;
	}
}

module.exports = Blackmagic_ATEM;

function processATEMTally(me, programInput, previewInput) {
	let self = this;

	let atemSourceFound = false;

	//first loop through the ATEM tally data array, by ME; if it's present, update the current program/preview inputs
	for (let i = 0; i < tallydata_ATEM.length; i++) {
		if (tallydata_ATEM[i].me === me.toString()) {
			atemSourceFound = true;
			tallydata_ATEM[i].programInput = programInput.toString();
			tallydata_ATEM[i].previewInput = previewInput.toString();
		}
	}

	//if it was not in the tally array for this ME, add it
	if (!atemSourceFound) {
		let atemTallyObj = {};
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
		if (source.data.me_onair.includes(tallydata_ATEM[i].me)) {
			allPrograms.push(tallydata_ATEM[i].programInput.toString());
			allPreviews.push(tallydata_ATEM[i].previewInput.toString());
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
		self.emit('data', tallyObj);
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
			self.emit('data', tallyObj);
		}
	}


	//GOTTA FIGURE THIS ONE OUT
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