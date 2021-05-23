/* Tally Arbiter: Source Type TSLUMD 3.1 TCP */
const EventEmitter = require('events');
const net = require('net');
const packet = require('packet');

const parser = packet.createParser();
parser.packet('tsl', 'b8{x1, b7 => address},b8{x2, b2 => brightness, b1 => tally4, b1 => tally3, b1 => tally2, b1 => tally1 }, b8[16] => label');

class TSLUMD_3_TCP extends EventEmitter {
    constructor(source) {
		super();
		this.sourceId = source.id;
		this.data = source.data;
	}

	start() {
		try {
			this.server = net.createServer(function (socket) {
				socket.on('data', function (data) {
					parser.extract('tsl', function (result) {
						result.label = new Buffer(result.label).toString();
						this.emit('data', result);
					});
					parser.parse(data);
				});
	
				socket.on('close', function () {
					this.stop();
				});
			})
			.listen(this.data.port, function() {
				self.emit('portinuse', self.data.port, true);
				this.emit('connected', true);
			});
		}
		catch (error) {
			this.emit('error', error);
		}
	}

	stop() {
		try {
			this.server.close(function() {});
			this.emit('connected', false);
			self.emit('portinuse', self.data.port, false);
		}
		catch (error) {
			this.emit('error', error);
		}
	}
}

module.exports = TSLUMD_3_TCP;