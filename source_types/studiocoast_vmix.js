/* Tally Arbiter: Source Type VMix */
const EventEmitter = require('events');
const net = require('net');

var tallydata_VMix = [];

class StudioCoast_VMix extends EventEmitter {
    constructor(source) {
		super();
		this.sourceId = source.id;
		this.data = source.data;
	}

	start() {
		let self = this;

		let ip = self.data.ip;
		let port = 8099;

		try {
			self.server = new net.Socket();
			self.server.connect(port, ip, function() {
				self.server.write('SUBSCRIBE TALLY\r\n');
				self.server.write('SUBSCRIBE ACTS\r\n');

				addVMixSource('{{RECORDING}}', 'Recording');
				addVMixSource('{{STREAMING}}', 'Streaming');

				self.emit('connection_state', true);
			});

			self.server.on('data', function (data) {
				data = data
				.toString()
				.split(/\r?\n/);

				tallyData = data.filter(text => text.startsWith('TALLY OK'));

				if (tallyData.length > 0) {
					logger(`Source: ${source.name}  VMix tally data received.`, 'info-quiet');
					for (let j = 9; j < tallyData[0].length; j++) {
						let address = j-9+1;
						let value = tallyData[0].charAt(j);

						//build an object like the TSL module creates so we can use the same function to process it
						let tallyObj = {};
						tallyObj.address = address.toString();
						tallyObj.brightness = 1;
						tallyObj.tally1 = ((value === '2') ? 1 : 0);
						tallyObj.tally2 = ((value === '1') ? 1 : 0);
						tallyObj.tally3 = 0;
						tallyObj.tally4 = 0;
						tallyObj.label = `Input ${address}`;
						self.emit('data', tallyObj);
						addVMixSource(tallyObj.address, tallyObj.label);
					}
				}
				else {
					//we received some other command, so lets process it
					if (data[0].indexOf('ACTS OK Recording ') > -1) {
						let value = false;
						if (data.indexOf('ACTS OK Recording 1') > -1) {
							value = true;
						}
						//build an object like the TSL module creates so we can use the same function to process it
						let tallyObj = {};
						tallyObj.address = '{{RECORDING}}';
						tallyObj.brightness = 1;
						tallyObj.tally1 = 0;
						tallyObj.tally2 = value;
						tallyObj.tally3 = 0;
						tallyObj.tally4 = 0;
						tallyObj.label = `Recording: ${value}`;
						self.emit('data', tallyObj);
					}

					if (data[0].indexOf('ACTS OK Streaming ') > -1) {
						let value = false;
						if (data.indexOf('ACTS OK Streaming 1') > -1) {
							value = true;
						}
						//build an object like the TSL module creates so we can use the same function to process it
						let tallyObj = {};
						tallyObj.address = '{{STREAMING}}';
						tallyObj.brightness = 1;
						tallyObj.tally1 = 0;
						tallyObj.tally2 = value;
						tallyObj.tally3 = 0;
						tallyObj.tally4 = 0;
						tallyObj.label = `Streaming: ${value}`;
						self.emit('data', tallyObj);
					}
				}
			});

			self.server.on('error', function(error) {
				self.emit('error', error);
			});

			self.server.on('close', function () {
				self.emit('error', error);
			});
		}
		catch (error) {
			self.emit('error', error);
		}
	}

	stop() {
		let self = this;
		try {
			//closing stuff
			self.server.write('QUIT\r\n');
		}
		catch (error) {
			self.emit('error', error);
		}
	}

	getTallyData() {
		return tallydata_VMix;
	}
}

module.exports = StudioCoast_VMix;

function addVMixSource(address, label) {
    //Double check its not there already
    var exists = tallydata_VMix.find(function(src){
        return (src.address == address);
	});
	
    if (exists !== undefined) return;
	
	//Doesn't exist, add it
    tallydata_VMix.push({
        label: label,
        address: address,
        tally1: 0,
        tally2: 0,
        tally3: 0,
        tally4: 0
	});
}