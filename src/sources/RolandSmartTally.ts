import axios from 'axios'
import { device_sources, logger } from '..'
import { RegisterTallyInput } from '../_decorators/RegisterTallyInput.decorator'
import { Source } from '../_models/Source'
import { TallyInput } from './_Source'

@RegisterTallyInput('4a58f00f', 'Roland Smart Tally', '', [
	{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
])
export class RolandSmartTallySource extends TallyInput {
	private interval: NodeJS.Timer
	constructor(source: Source) {
		super(source)
		this.connected.next(true)
		this.interval = setInterval(() => this.checkRolandStatus(), 500)
	}

	public checkRolandStatus() {
		let ip = this.source.data.ip

		for (const deviceSource of device_sources.filter((s) => s.sourceId === this.source.id)) {
			let address = deviceSource.address
			axios
				.get(`http://${ip}/tally/${address}/status`)
				.then((response) => {
					let tallyObj: any = {}
					tallyObj.address = address
					tallyObj.label = address
					tallyObj.tally4 = 0
					tallyObj.tally3 = 0
					tallyObj.tally2 = 0
					tallyObj.tally1 = 0
					tallyObj.preview = 0
					tallyObj.program = 0

					switch (response.data) {
						case 'onair':
							this.setBussesForAddress(address, ['program'])
							break
						case 'selected':
							this.setBussesForAddress(address, ['preview'])
							break
						case 'unselected':
						default:
							this.setBussesForAddress(address, [])
							break
					}
					this.sendTallyData()
				})
				.catch((error) => {
					logger(`Source: ${this.source.name}  Roland Smart Tally Error: ${error}`, 'error')
				})
		}
	}

	public exit(): void {
		super.exit()
		clearInterval(this.interval)
		this.connected.next(false)
	}
}
