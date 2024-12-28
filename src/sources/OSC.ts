import { logger } from '..'
import { RegisterTallyInput } from '../_decorators/RegisterTallyInput.decorator'
import { FreePort, UsePort } from '../_decorators/UsesPort.decorator'
import { Source } from '../_models/Source'
import { TallyInput } from './_Source'
import osc from 'osc'

@RegisterTallyInput('05d6bce1', 'Open Sound Control (OSC)', '', [
	{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
	{
		fieldName: 'info',
		fieldLabel: 'Information',
		text: "The device source address should be sent as an integer or a string to the server's IP address on the specified port. Sending to /tally/preview_on designates it as a Preview command, and /tally/program_on designates it as a Program command. Sending /tally/previewprogram_on and /tally/previewprogram_off will send both bus states at the same time. To turn off a preview or program, use preview_off and program_off. The first OSC argument received will be used for the device source address.",
		fieldType: 'info',
	},
])
export class OSCSource extends TallyInput {
	private server: any
	constructor(source: Source) {
		super(source)

		UsePort(source.data.port, source.id)
		this.server = new osc.UDPPort({
			localAddress: '0.0.0.0',
			localPort: source.data.port,
			metadata: true,
		})

		this.server.on('message', (oscMsg, timeTag, info) => {
			logger(
				`Source: ${source.name} OSC message received: ${oscMsg.address} ${oscMsg.args[0].value.toString()}`,
				'info-quiet',
			)
			const address = oscMsg.args[0].value.toString()
			switch (oscMsg.address) {
				case '/tally/preview_on':
					this.addBusToAddress(address, 'preview')
					break
				case '/tally/preview_off':
					this.removeBusFromAddress(address, 'preview')
					break
				case '/tally/program_on':
					this.addBusToAddress(address, 'program')
					break
				case '/tally/program_off':
					this.removeBusFromAddress(address, 'program')
					break
				case '/tally/previewprogram_on':
					this.addBusToAddress(address, 'preview')
					this.addBusToAddress(address, 'program')
					break
				case '/tally/previewprogram_off':
					this.removeBusFromAddress(address, 'preview')
					this.removeBusFromAddress(address, 'program')
					break
				default:
					break
			}
			this.sendTallyData()
		})

		this.server.on('error', (error) => {
			logger(`Source: ${source.name} OSC Error: ${error}`, 'error')
		})

		this.server.on('ready', () => {
			this.connected.next(true)
		})

		this.server.open()
	}

	public exit(): void {
		super.exit()
		this.server.close()
		FreePort(this.source.data.port, this.source.id)
		this.connected.next(false)
	}
}
