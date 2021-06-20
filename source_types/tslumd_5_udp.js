/* Tally Arbiter: Source Type TSLUMD 5 UDP */
const EventEmitter = require('events');
const dgram = require('dgram');

class TSLUMD_5_UDP extends EventEmitter {
    constructor(source) {
		super();
		this.sourceId = source.id;
		this.data = source.data;
	}

	start() {
		let self = this;

		try {
			self.server = dgram.createSocket('udp4');
			self.server.bind(self.data.port);

			self.emit('portinuse', self.data.port, true);

			self.server.on('message', function (data) {
				self.processData(data);
			});

			self.emit('connection_state', true);
		}
		catch (error) {
			self.emit('error', error);
		}
	}

	stop() {
		let self = this;
		try {
			self.server.close();
			self.emit('connection_state', false);
			self.emit('portinuse', self.data.port, false);
		}
		catch (error) {
			self.emit('error', error);
		}
	}

	processData(data) {
		let self = this;

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

			self.emit('data', newTallyObj);
		}
	}
}

module.exports = TSLUMD_5_UDP;