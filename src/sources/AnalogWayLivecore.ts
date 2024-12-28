import { logger } from '..'
import { RegisterTallyInput } from '../_decorators/RegisterTallyInput.decorator'
import { Source } from '../_models/Source'
import { TallyInput } from './_Source'
import net from 'net'

const LivecoreDeviceNames: Record<string, string> = {
	'97': 'ORX_1 NeXtage 16',
	'98': 'ORX_2 SmartMatriX Ultra',
	'99': 'ORX_3 Ascender 32',
	'100': 'ORX_4 Ascender 48',
	'102': 'LOE_16 Output Expander 16',
	'103': 'LOE_32 Output Expander 32',
	'104': 'LOE_48 Output Expander 48',
	'105': 'NXT1604_4K NeXtage 16 4K',
	'106': 'SMX12x4_4K SmartMatrix Ultra 4K',
	'107': 'ASC3204_4K Ascender 32 4K',
	'108': 'ASC4806_4K Ascender 48 4K',
	'109': 'LOE016_4K Ouput Expander 16 4K',
	'110': 'LOE032_4K Ouput Expander 32 4K',
	'111': 'LOE048_4K Ouput Expander 48 4K',
	'112': 'ASC016 Ascender 16',
	'113': 'ASC016_4K Ascender 16 4K',
	'114': 'ASC048_PL Ascender 48 4K PL',
	'115': 'LOE48_PL Ouput Expander 48 4K PL',
	'116': 'NXT0802 NeXtage 8',
	'117': 'NXT0802_4K NeXtage 8 4K',
	'118': 'ASC032_PL Ascender 32 4K PL',
	'119': 'LOE032_PL Ouput Expander 32 4K PL',
}

@RegisterTallyInput(
	'a378e29d',
	'Analog Way Livecore',
	'Standard port is 10600. Source addresses are the input number.',
	[
		{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
		{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
	],
)
export class AWLivecoreSource extends TallyInput {
	private client: any
	private port: number // AnalogWay Livecore TCP port number
	private last_heartbeat: number
	private tallydata_AWLivecore: any[] = []
	private heartbeat_interval: NodeJS.Timer

	constructor(source: Source) {
		super(source)
		this.port = source.data.port

		this.client = new net.Socket()

		this.client.on('connect', () => {
			this.client.write('?\n')
			this.connected.next(true)

			this.last_heartbeat = Date.now()
			this.heartbeat_interval = setInterval(() => {
				if (Date.now() - this.last_heartbeat > 5000) {
					clearInterval(this.heartbeat_interval)
					this.client.end()
					this.client.destroy()
					this.connected.next(false)
				} else {
					this.client.write('PCdgs\n')
				}
			}, 1000)
		})

		this.client.on('data', (data) => {
			//logger(`Source: ${source.name}  AW Livecore data received.`, 'info-quiet');
			data = data.toString().split(/\r?\n/)

			const deviceState = data.filter((text) => text.startsWith('PCdgs'))
			const deviceData = data.filter((text) => text.startsWith('DEV'))
			const tallyProgramData = data.filter((text) => text.startsWith('TAopr'))
			const tallyPreviewData = data.filter((text) => text.startsWith('TAopw'))

			if (deviceState.length > 0) {
				this.last_heartbeat = Date.now()
				//let state = deviceState[0].substring(5);
				//logger(`Source: ${source.name}  AW Livecore state: ` + state, 'info-quiet');
			}

			if (tallyProgramData.length > 0) {
				logger(`Source: ${source.name}  AW Livecore tally program data received.`, 'info-quiet')

				let address = tallyProgramData[0].substring(5, tallyProgramData[0].indexOf(','))
				let value = tallyProgramData[0].charAt(tallyProgramData[0].indexOf(',') + 1)

				let tallyObj: any = {}
				tallyObj.address = address.toString()
				tallyObj.tally2 = value === '1' ? 1 : 0 // Program
				tallyObj.program = value === '1' ? 1 : 0 // Program
				tallyObj.label = `Input ${address}`
				this.processAWLivecoreTally(tallyObj)
			}

			if (tallyPreviewData.length > 0) {
				logger(`Source: ${source.name}  AW Livecore tally preview data received.`, 'info-quiet')

				let address = tallyPreviewData[0].substring(5, tallyPreviewData[0].indexOf(','))
				let value = tallyPreviewData[0].charAt(tallyPreviewData[0].indexOf(',') + 1)

				let tallyObj: any = {}
				tallyObj.address = address.toString()
				tallyObj.tally1 = value === '1' ? 1 : 0 // Preview
				tallyObj.preview = value === '1' ? 1 : 0 // Preview
				tallyObj.label = `Input ${address}`
				this.processAWLivecoreTally(tallyObj)
			}

			if (deviceData.length > 0) {
				let deviceType = deviceData[0].substring(3)
				const deviceName = LivecoreDeviceNames[deviceType] || 'Unknown Device'
				logger('AW device type: ' + deviceType + ' (' + deviceName + ')', 'info-quiet')
			}
		})

		this.client.on('close', () => {
			this.connected.next(false)
		})

		this.client.on('error', (error) => {
			logger(`Source: ${source.name}  AW Livecore Connection Error occurred: ${error}`, 'error')
		})

		this.connect()
	}

	private processAWLivecoreTally(tallyObj) {
		let AWLivecoreSourceFound = false
		for (let j = 0; j < this.tallydata_AWLivecore.length; j++) {
			if (this.tallydata_AWLivecore[j].address === tallyObj.address) {
				AWLivecoreSourceFound = true
				break
			}
		}

		if (!AWLivecoreSourceFound) {
			//the source is not in the AWLivecore array, we don't know anything about it, so add it to the array
			let newTallyObj: any = {}
			newTallyObj.label = tallyObj.label
			newTallyObj.address = tallyObj.address
			newTallyObj.tally4 = 0
			newTallyObj.tally3 = 0
			newTallyObj.tally2 = 0 // PGM
			newTallyObj.tally1 = 0 // PVW
			newTallyObj.preview = 0
			newTallyObj.program = 0
			this.tallydata_AWLivecore.push(newTallyObj)
		}

		this.removeBusFromAllAddresses('preview')
		this.removeBusFromAllAddresses('program')
		for (let i = 0; i < this.tallydata_AWLivecore.length; i++) {
			if (this.tallydata_AWLivecore[i].address === tallyObj.address) {
				if (tallyObj.tally1 !== undefined) {
					// PVW
					this.tallydata_AWLivecore[i].tally1 = tallyObj.tally1
					this.tallydata_AWLivecore[i].preview = tallyObj.tally1
					this.addBusToAddress(this.tallydata_AWLivecore[i].addresses, 'preview')
				}
				if (tallyObj.tally2 !== undefined) {
					// PGM
					this.tallydata_AWLivecore[i].tally2 = tallyObj.tally2
					this.tallydata_AWLivecore[i].program = tallyObj.tally2
					this.addBusToAddress(this.tallydata_AWLivecore[i].addresses, 'program')
				}
			}
		}
	}

	private connect(): void {
		this.client.connect(this.port, this.source.data.ip)
	}

	public reconnect(): void {
		this.connect()
	}

	public exit(): void {
		super.exit()
		clearInterval(this.heartbeat_interval)
		this.client.end()
		this.client.destroy()
		this.connected.next(false)
	}
}
