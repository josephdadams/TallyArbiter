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
						//info about what the switcher can do, process this later
					}
					else if ((path[h].indexOf('video.mixEffects') > -1) || (path[h].indexOf('video.ME') > -1)) {				
						for (let i = 0; i < state.video.mixEffects.length; i++) {
								let atemSourceFound = false;

								//first loop through the ATEM tally data array, by SourceId and ME; if it's present, update the current program/preview inputs
								for (let k = 0; k < tallydata_ATEM.length; k++) {
									if (tallydata_ATEM[k].sourceId === sourceId) {
										if (tallydata_ATEM[k].me === (state.video.mixEffects[i].index).toString()) {
					
											atemSourceFound = true;												

											tallydata_ATEM[k].programInput = [];
											tallydata_ATEM[k].previewInput = [];
											
											// ##### SuperSource is on PGM
											if (state.video.mixEffects[i].programInput >= 6000 && state.video.mixEffects[i].programInput < 6010) {
												// --> since I do have no access to an ATEM with more than one SSRC we'll stay on the "safe side" … 
												// most likely a second SSRC would have inputID 6001 - but I don't know. ;-)

													for (let n = 0; n < state.video.superSources.length; n++) {
														for (let m = 0; m < state.video.superSources[n].boxes.length; m++) {
														//check if box "m" is enabled - if the box is not enabled, we do not have to show tally for the source.
															if (state.video.superSources[n].boxes[m].enabled) {
																// Add the source of the box to the tallydata_ATEM[k].programInput Array
																tallydata_ATEM[k].programInput.push(state.video.superSources[n].boxes[m].source.toString());
															}	
														}
													}
											// ##### something else that SSRC is on PGM
											}
											else {
													tallydata_ATEM[k].programInput.push(state.video.mixEffects[i].programInput.toString());
											}
											
											// ##### SuperSource is on PVW
											if (state.video.mixEffects[i].previewInput >= 6000 && state.video.mixEffects[i].previewInput < 6010) {
												for (let n = 0; n < state.video.superSources.length; n++) {
														for (let m = 0; m < state.video.superSources[n].boxes.length; m++) {
														//check if box "m" is enabled - if the box is not enabled, we do not have to show tally for the source.
															if (state.video.superSources[n].boxes[m].enabled) {
																// Add the source of the box to the tallydata_ATEM[k].previewInput Array
																tallydata_ATEM[k].previewInput.push(state.video.superSources[n].boxes[m].source.toString());
															}	
														}
													}
											// ##### something else that SSRC is on PVW
											}
											else {
													tallydata_ATEM[k].previewInput.push(state.video.mixEffects[i].previewInput.toString());																										
											}
										}
									}
								}

								//if it was not in the tally array for this SourceId and ME, add it
								if (!atemSourceFound) {
									let atemTallyObj = {};
									atemTallyObj.sourceId = sourceId;
									atemTallyObj.me = state.video.mixEffects[i].index.toString();
									
									atemTallyObj.programInput = [];
									atemTallyObj.previewInput = [];
											
									// ##### SuperSource is on PGM
									if (state.video.mixEffects[i].programInput >= 6000 && state.video.mixEffects[i].programInput < 6010) {
											for (let n = 0; n < state.video.superSources.length; n++) {
												for (let m = 0; m < state.video.superSources[n].boxes.length; m++) {
													if (state.video.superSources[n].boxes[m].enabled) {
														atemTallyObj.programInput.push(state.video.superSources[n].boxes[m].source.toString());
													}	
												}
											}
									// ##### something else that SSRC is on PGM
									}
									else {
											atemTallyObj.programInput.push(state.video.mixEffects[i].programInput.toString());
									}
									
									// ##### SuperSource is on PVW
									if (state.video.mixEffects[i].previewInput >= 6000 && state.video.mixEffects[i].previewInput < 6010) {
										for (let n = 0; n < state.video.superSources.length; n++) {
												for (let m = 0; m < state.video.superSources[n].boxes.length; m++) {
													if (state.video.superSources[n].boxes[m].enabled) {
														atemTallyObj.previewInput.push(state.video.superSources[n].boxes[m].source.toString());
													}	
												}
											}
									// ##### something else that SSRC is on PVW
									}
									else {
										atemTallyObj.previewInput.push(state.video.mixEffects[i].previewInput.toString());
									}
									
									tallydata_ATEM.push(atemTallyObj);
								}
						}
						processATEMTally();
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

function processATEMTally() {
	let self = this;

	/now loop through the updated array, and if an ME is one chosen to monitor for this SourceId,
	//grab the program input and put it into a temp array of program inputs
	//grab the preview input and put it into a temp array of preview inputs


	let allPrograms = [];
	let allPreviews = [];

	for (let z = 0; z < tallydata_ATEM.length; z++) {

		if (tallydata_ATEM[z].sourceId === sourceId) {
			let currentME = parseInt(tallydata_ATEM[z].me) + 1;
			if (source.data.me_onair.includes(currentME.toString())) {	
						
				for (let y = 0; y < tallydata_ATEM[z].programInput.length; y++) {
					
					allPrograms.push(tallydata_ATEM[z].programInput[y]);
					
				}

				for (let y = 0; y < tallydata_ATEM[z].previewInput.length; y++) {
					
						allPreviews.push(tallydata_ATEM[z].previewInput[y]);
						
				}
					
			}
			else {
					
				console.log ('ME ' + currentME + ' was not selected');
				
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
			self.emit('data', tallyObj);
		}
	}
}