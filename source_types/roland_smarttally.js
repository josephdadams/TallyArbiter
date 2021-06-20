/* Tally Arbiter: Source Type Roland Smart Tally */
const EventEmitter = require('events');
const axios = require('axios');

var tallydata_RolandSmartTally = [];

class Roland_SmartTally extends EventEmitter {
    constructor(source) {
		super();
		this.sourceId = source.id;
		this.data = source.data;
	}

	start() {
		let self = this;

		try {
			self.server = setInterval(checkRolandStatus, 500);
			self.emit('connection_state', true);
		}
		catch (error) {
			self.emit('error', error);
		}
	}

	stop() {
		let self = this;
		try {
			//closing stuff
			clearInterval(self.server);
		}
		catch (error) {
			self.emit('error', error);
		}
	}

	getTallyData() {
		return tallydata_RolandSmartTally;
	}
}

module.exports = Roland_SmartTally;

function checkRolandStatus() {
	let ip = source.data.ip;

	for (let j = 1; j <= 8; j++) {
		axios.get(`http://${ip}/tally/${i}/status`)
		.then(function (response) {
			let tallyObj = {};
			tallyObj.address = i;
			tallyObj.label = i;
			tallyObj.tally4 = 0;
			tallyObj.tally3 = 0;
			tallyObj.tally2 = 0;
			tallyObj.tally1 = 0;

			switch(response.data)
			{
				case "onair":
					tallyObj.tally2 = 1;
					tallyObj.tally1 = 0;
					break;
				case "selected":
					tallyObj.tally2 = 0;
					tallyObj.tally1 = 1;
					break;
				case "unselected":
				default:
					tallyObj.tally2 = 0;
					tallyObj.tally1 = 0;
					break;
			}
			self.emit('data', tallyObj);

			addRolandTally(tallyObj);
		})
		.catch(function (error) {
			self.emit('error', error);
		});
	}
}

function addRolandTally(tallyObj) {
	//Double check its not there already
    var exists = tallydata_RolandSmartTally.find(function(src){
        return (src.address == tallyObj.address);
	});
	
    if (exists !== undefined) return;
	
	//Doesn't exist, add it
    tallydata_RolandSmartTally.push(tallyObj);
}