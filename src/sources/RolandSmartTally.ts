import axios from 'axios'
import { device_sources, logger } from '..'
import { RegisterTallyInput } from '../_decorators/RegisterTallyInput.decorator'
import { Source } from '../_models/Source'
import { TallyInput } from './_Source'

@RegisterTallyInput(
	'4a58f00f',
	'Roland Smart Tally',
	'Username and password are only required if your switcher (e.g. the V-80HD) has web authentication enabled. Leave them blank otherwise.',
	[
		{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
		{ fieldName: 'username', fieldLabel: 'Username', fieldType: 'text', optional: true },
		{ fieldName: 'password', fieldLabel: 'Password', fieldType: 'password', optional: true },
	],
)
export class RolandSmartTallySource extends TallyInput {
	private interval: NodeJS.Timeout
	constructor(source: Source) {
		super(source)
		this.connected.next(true)
		this.interval = setInterval(() => this.checkRolandStatus(), 500)
	}

	public checkRolandStatus() {
		let ip = this.source.data.ip
		let username = this.source.data.username
		let password = this.source.data.password

		// Only send HTTP Basic credentials if a username was actually configured;
		// switchers without web auth (the common case) must not receive an auth header.
		const requestConfig = username ? { auth: { username, password: password || '' } } : undefined

		for (const deviceSource of device_sources.filter((s) => s.sourceId === this.source.id)) {
			let address = deviceSource.address

			if (!address) {
				logger(
					`Device source ${deviceSource.id} has no address/input number configured; skipping Roland Smart Tally poll.`,
					'error',
				)
				continue
			}

			axios
				.get(`http://${ip}/tally/${address}/status`, requestConfig)
				.then((response) => {
					this.connected.next(true)

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
					this.connected.next(false)
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
