import { logger } from '..'
import { RegisterTallyInput } from '../_decorators/RegisterTallyInput.decorator'
import { Source } from '../_models/Source'
import { TallyInput } from './_Source'
import net from 'net'

@RegisterTallyInput('627a5902', 'Blackmagic VideoHub', 'Uses Port 9990.', [
	{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
	{ fieldName: 'destinations_pvw', fieldLabel: 'Destinations to monitor as PVW', fieldType: 'text' },
	{ fieldName: 'destinations_pgm', fieldLabel: 'Destinations to monitor as PGM', fieldType: 'text' },
])
export class BlackmagicVideoHubSource extends TallyInput {
	private client: net.Socket
	private port = 9990 // Fixed VideoHub TCP port number
	private receiveBuffer: string
	private command: any
	private stash: any[]
	private labels: Record<number, string> = {}
	private destinations: { destination: number; source: number }[] = []
	private tallydata: { address: number; label: string }[] = []

	constructor(source: Source) {
		super(source)

		this.client = new net.Socket()

		this.receiveBuffer = ''
		this.command = null
		this.stash = []

		this.client.on('connect', () => {
			this.connected.next(true)
		})

		this.client.on('data', (chunk) => {
			let j = 0,
				line = '',
				offset = 0
			this.receiveBuffer += chunk

			while ((j = this.receiveBuffer.indexOf('\n', offset)) !== -1) {
				line = this.receiveBuffer.substr(offset, j - offset)
				offset = j + 1
				this.client.emit('receiveline', line.toString())
			}

			this.receiveBuffer = this.receiveBuffer.substr(offset)
		})

		this.client.on('receiveline', (line) => {
			if (this.command === null && line.match(/:/)) {
				this.command = line
			} else if (this.command !== null && line.length > 0) {
				this.stash.push(line.trim())
			} else if (line.length === 0 && this.command !== null) {
				let cmd = this.command.trim().split(/:/)[0]

				this.processVideohubInformation(cmd)

				this.stash = []
				this.command = null
			}
		})

		this.client.on('close', () => {
			this.connected.next(false)
		})

		this.client.on('error', (error) => {
			logger(`VideoHub Connection Error occurred: ${error}`, 'error')
		})

		this.connect()
	}

	private processVideohubInformation(cmd) {
		if (cmd.match(/VIDEO OUTPUT ROUTING/)) {
			for (let i = 0; i < this.stash.length; i++) {
				let destination = parseInt(this.stash[i].substr(0, this.stash[i].indexOf(' ')))
				let source = parseInt(this.stash[i].substr(this.stash[i].indexOf(' ')))
				destination++ // zero-based so we increment it
				source++ // zero-based so we increment it

				this.processVideoHubTally(destination, source)
			}
		} else if (cmd.match(/INPUT LABELS/)) {
			for (let i = 0; i < this.stash.length; i++) {
				let source = parseInt(this.stash[i].substr(0, this.stash[i].indexOf(' ')))
				source++ // zero-based so we increment it
				let name = this.stash[i].substr(this.stash[i].indexOf(' '))
				this.addVideoHubInformation(source, name)
			}
		}
	}

	private addVideoHubInformation(source: number, name: string) {
		this.labels[source] = name
	}

	private processVideoHubTally(destination: number, src: number) {
		//this builds the tallydata array and makes sure it has an initial state
		let tallyFound = false

		for (let i = 0; i < this.tallydata.length; i++) {
			if (this.tallydata[i].address === src) {
				tallyFound = true
				break
			}
		}

		if (!tallyFound) {
			let tallyObj = {
				address: src,
				label: this.labels[src],
			}
			this.tallydata.push(tallyObj)
		}

		this.updateVideoHubDestination(destination, src)
	}

	private updateVideoHubDestination(destination: number, src: number) {
		//maintains an array of videohub destinations and their active sources

		let found = false

		let recheck_sources: number[] = []

		//loop through and update the destinations array with the new source
		//if the source has changed, add the previous source to a new array to recheck the state of that source
		for (let i = 0; i < this.destinations.length; i++) {
			if (this.destinations[i].destination === destination) {
				if (this.destinations[i].source !== src) {
					//the source has changed, so we will need to recheck that old source to make sure it is not in pvw/pgm anywhere else
					recheck_sources.push(this.destinations[i].source)
				}
				this.destinations[i].source = src
				found = true
				break
			}
		}

		if (!found) {
			let destinationObj = {
				destination,
				source: src,
			}
			this.destinations.push(destinationObj)
		}

		//check to see if any of the destinations currently have this source and if that destination is configured as a preview or program bus
		let inPreview = false
		let inProgram = false

		for (let i = 0; i < this.destinations.length; i++) {
			if (this.destinations[i].source === src) {
				if (this.source.data.destinations_pvw.includes(this.destinations[i].destination)) {
					inPreview = true
				}
				if (this.source.data.destinations_pgm.includes(this.destinations[i].destination)) {
					inProgram = true
				}
			}
		}

		const busses = []
		if (inPreview) busses.push('preview')
		if (inProgram) busses.push('program')
		this.setBussesForAddress(src.toString(), busses)

		//now recheck any source that used to be in this destination and make sure they are not in pvw/pgm elsewhere
		for (let i = 0; i < recheck_sources.length; i++) {
			let inPreview = false
			let inProgram = false
			for (let j = 0; j < this.destinations.length; j++) {
				if (this.destinations[j].source === recheck_sources[i]) {
					//check and see if this destination is a pvw or pgm type
					if (this.source.data.destinations_pvw.includes(this.destinations[j].destination)) {
						inPreview = true
					}
					if (this.source.data.destinations_pgm.includes(this.destinations[j].destination)) {
						inProgram = true
					}
				}
			}

			const busses = []
			if (inPreview) busses.push('preview')
			if (inProgram) busses.push('program')
			this.setBussesForAddress(recheck_sources[i].toString(), busses)
		}
		this.sendTallyData()
	}

	private connect(): void {
		this.client.connect(this.port, this.source.data.ip)
	}

	public reconnect(): void {
		this.connect()
	}

	public exit(): void {
		super.exit()
		this.client.end()
	}
}
