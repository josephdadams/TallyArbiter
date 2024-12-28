import { logger } from '..'
import { RegisterTallyInput } from '../_decorators/RegisterTallyInput.decorator'
import { Source } from '../_models/Source'
import { TallyInput } from './_Source'
import net from 'net'

@RegisterTallyInput('58b6af42', 'VMix', 'Uses Port 8099.', [
	{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
])
export class VMixSource extends TallyInput {
	private client: any
	private port = 8099 // Fixed vMix TCP port number
	constructor(source: Source) {
		super(source)

		this.client = new net.Socket()

		this.client.on('connect', () => {
			this.client.write('SUBSCRIBE TALLY\r\n')
			this.client.write('SUBSCRIBE ACTS\r\n')

			this.addAddress('Recording', '{{RECORDING}}')
			this.addAddress('Streaming', '{{STREAMING}}')

			this.connected.next(true)
		})

		this.client.on('data', (data) => {
			logger(`Source: ${source.name}  VMix data received.`, 'info-quiet')
			data = data.toString().split(/\r?\n/)

			const tallyData = data.filter((text) => text.startsWith('TALLY OK'))

			// If received data contains TALLY information loop through the
			// data and set preview and program based on received data.
			if (tallyData.length > 0) {
				logger(`Source: ${source.name}  VMix tally data received.`, 'info-quiet')
				for (let j = 9; j < tallyData[0].length; j++) {
					let address = j - 9 + 1
					let value = tallyData[0].charAt(j)

					this.addAddress(`Input ${address}`, address.toString())
					const busses = []
					if (value === '2') {
						busses.push('preview')
					}
					if (value === '1') {
						busses.push('program')
					}
					this.setBussesForAddress(address.toString(), busses)
				}
				this.sendTallyData()
			} else {
				//we received some other command, so lets process it
				if (data[0].indexOf('ACTS OK Recording ') > -1) {
					this.setBussesForAddress('{{RECORDING}}', [])
					if (data.indexOf('ACTS OK Recording 1') > -1) {
						this.setBussesForAddress('{{RECORDING}}', ['program'])
					}
					this.sendTallyData()
				}

				if (data[0].indexOf('ACTS OK Streaming ') > -1) {
					this.setBussesForAddress('{{STREAMING}}', [])
					if (data.indexOf('ACTS OK Streaming 1') > -1) {
						this.setBussesForAddress('{{STREAMING}}', ['program'])
						this.sendTallyData()
					}
					this.sendTallyData()
				}
			}
		})

		this.client.on('close', () => {
			this.connected.next(false)
		})

		this.client.on('error', (error) => {
			logger(`Source: ${source.name}  VMix Connection Error occurred: ${error}`, 'error')
		})

		this.connect()
	}

	private connect(): void {
		this.client.connect(this.port, this.source.data.ip)
	}

	public reconnect(): void {
		this.connect()
	}

	public exit(): void {
		super.exit()
		this.client.write('QUIT\r\n')
	}
}
