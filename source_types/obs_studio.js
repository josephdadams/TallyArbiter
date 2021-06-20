

/* Tally Arbiter: Source Type OBS Studio */
const EventEmitter = require('events');
const OBS = require('obs-websocket-js');

var tallydata_OBS = [];

class OBS_Studio extends EventEmitter {
    constructor(source) {
		super();
		this.sourceId = source.id;
		this.data = source.data;
	}

	start() {
		let self = this;

		let ip = self.data.ip;
		let port = self.data.port;
		let password = self.data.password;

		try {
			self.server = new OBS();
			self.server.ip = ip;
			self.server.connect({address: ip + ':' + port, password: password}, function (data) {
				self.emit('connection_state', true);
			})
			.catch(function (error) {
				self.emit('connection_state', false);
				if (error.code === 'CONNECTION_ERROR') {
					self.emit('error', 'Error connecting. Is OBS running?');
				}
			});

			self.server.on('error', function(error) {
				self.emit('error', error);
			});

			self.server.on('ConnectionOpened', function (data) {
				addOBSSource('{{STREAMING}}');
				addOBSSource('{{RECORDING}}');

				//Retrieve all the current sources and add them
				self.server.sendCallback('GetSourcesList', function(err,data) {
					if (err || data.sources == undefined) return;
					data.sources.forEach(source => {
						addOBSSource(source.name);
					});
				});
			});

			self.server.on('ConnectionClosed', function (data) {
				self.emit('connection_state', false);
			});

			self.server.on('AuthenticationSuccess', function (data) {
				//todo: send generic message back
			});

			self.server.on('AuthenticationFailure', function (data) {
				self.emit('error', 'Authentication error.');
			});

			self.server.on('PreviewSceneChanged', function (data) {
				if (data) {
					if (data.sources)
					{
						processOBSTally(data.sources, 'preview');
					}
				}
			});

			self.server.on('SwitchScenes', function (data) {
				if (data) {
					if (data.sources)
					{
						processOBSTally(data.sources, 'program');
					}
				}
			});
			
			self.server.on('SourceCreated', function (data) {
				addOBSSource(data.sourceName);
			});
			
			self.server.on('SourceDestroyed', function (data) {
				deleteOBSSource(data.sourceName);
			});
			
			self.server.on('SourceRenamed', function (data) {
				renameOBSSource(data.previousName,data.newName);                        
			});

			self.server.on('StreamStarted', function(data) {
				let obsTally = [
					{
						name: '{{STREAMING}}',
						render: true
					}
				];
				processOBSTally(obsTally, 'program');
			});
	
			self.server.on('StreamStopped', function() {
				let obsTally = [
					{
						name: '{{STREAMING}}',
						render: false
					}
				];
				processOBSTally(obsTally, 'program');
			});

			self.server.on('RecordingStarted', function() {
				let obsTally = [
					{
						name: '{{RECORDING}}',
						render: true
					}
				];
				processOBSTally(obsTally, 'program');
			});
	
			self.server.on('RecordingStopped', function() {
				let obsTally = [
					{
						name: '{{RECORDING}}',
						render: false
					}
				];
				processOBSTally(obsTally, 'program');
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
			self.server.disconnect();
			self.emit('connection_state', false);
		}
		catch (error) {
			self.emit('error', error);
		}
	}

	getTallyData() {
		return tallydata_VMix;
	}
}

module.exports = OBS_Studio;

function addOBSSource(name) {
    //Double check its not there already, this also allows methods like processOBSTally to call this without caring whether it already exists or not
    var exists = tallydata_OBS.find(function(src){
        return (src.address == name);
    });
    if(exists !== undefined) return;
    //Doesn't exist, add it
    tallydata_OBS.push({
        label: name,
        address: name,
        tally1: 0,
        tally2: 0,
        tally3: 0,
        tally4: 0
    });
}

function renameOBSSource(oldname, newname) {
    let sourceIndex = tallydata_OBS.findIndex(src => src.address === oldname);
    if(sourceIndex === undefined) return;
    tallydata_OBS[sourceIndex].label = newname;
    tallydata_OBS[sourceIndex].address = newname;
}

function deleteOBSSource(name) {
    let sourceIndex = tallydata_OBS.findIndex(src => src.address === name);
    if(!sourceIndex) return;
    tallydata_OBS.splice(sourceIndex, 1);
}

function processOBSTally(sourceArray, tallyType) {
	let self = this;

	for (let i = 0; i < sourceArray.length; i++) {
        addOBSSource(sourceId,sourceArray[i].name);
	}

	for (let i = 0; i < tallydata_OBS.length; i++) {
		let obsSourceFound = false;
		for (let j = 0; j < sourceArray.length; j++) {
			if (tallydata_OBS[i].address === sourceArray[j].name) {
				obsSourceFound = true;
				//update the tally state because OBS is saying this source is not in the current scene
				switch(tallyType) {
					case 'preview':
						tallydata_OBS[i].tally1 = ((sourceArray[j].render) ? 1 : 0);
						break;
					case 'program':
						tallydata_OBS[i].tally2 = ((sourceArray[j].render) ? 1 : 0);
						break;
					default:
						break;
				}
				self.emit('data', tallydata_OBS[i]);
				break;
			}
		}

		if ((tallydata_OBS[i].address !== '{{STREAMING}}') && (tallydata_OBS[i].address !== '{{RECORDING}}')) {
			if (!obsSourceFound) {
				//it is no longer in the bus, mark it as such
				switch(tallyType) {
					case 'preview':
						tallydata_OBS[i].tally1 = 0;
						break;
					case 'program':
						tallydata_OBS[i].tally2 = 0;
						break;
					default:
						break;
				}
				self.emit('data', tallydata_OBS[i]);
			}
		}
	}
}