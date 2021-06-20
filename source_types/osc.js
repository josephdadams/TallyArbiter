/* Tally Arbiter: Source Type OSC */
const EventEmitter = require('events');
const osc = require('osc');

class OSC extends EventEmitter {
    constructor(source) {
		super();
		this.sourceId = source.id;
		this.data = source.data;
	}

	start() {
		let self = this;

		try {
			self.server = new osc.UDPPort({
				localAddress: '0.0.0.0',
				localPort: source.data.port,
				metadata: true
			});

			self.server.on('message', function (oscMsg, timeTag, info) {
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
				self.emit('data', tallyObj);
			});

			self.server.on('error', function (error) {
				self.emit('error', error);
			});

			self.server.on('ready', function () {
				self.emit('connection_state', true);
				self.emit('portinuse', self.data.port, true);
			});

			self.server.on('close', function() {
				self.emit('connection_state', true);
				self.emit('portinuse', self.data.port, true);
			});

			self.server.open();
		}
		catch (error) {
			self.emit('error', error);
		}
	}

	stop() {
		let self = this;
		try {
			self.server.close();
		}
		catch (error) {
			self.emit('error', error);
		}
	}
}

module.exports = OSC;