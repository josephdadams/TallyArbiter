/* Tally Arbiter: Source Type TSLUMD 3.1 UDP */
const EventEmitter = require('events');
const tsl_umd = require("tsl-umd");

class TSLUMD_3_UDP extends EventEmitter {
    constructor(source) {
		super();
		this.sourceId = source.id;
		this.data = source.data;
	}

	start() {
		let self = this;

		try {
			self.server = new tsl_umd(self.data.port);

			self.emit('portinuse', self.data.port, true);

			self.server.on('message', function (data) {
				self.emit('data', data);
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
			self.server.server.close();
			self.emit('connection_state', false);
			self.emit('portinuse', self.data.port, false);
		}
		catch (error) {
			self.emit('error', error);
		}
	}
}

module.exports = TSLUMD_3_UDP;