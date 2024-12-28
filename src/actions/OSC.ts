import { logger } from '..'
import { RegisterAction } from '../_decorators/RegisterAction'
import { Action } from './_Action'
import osc from 'osc'
import { UsePort } from '../_decorators/UsesPort.decorator'

logger('Starting OSC Setup.', 'info-quiet')

const oscPort = 5958
UsePort(oscPort, '58da987d')
const oscUDP = new osc.UDPPort({
	localAddress: '0.0.0.0',
	localPort: oscPort,
	broadcast: true,
	metadata: true,
})

oscUDP.on('error', function (error) {
	logger(`An OSC error occurred: ${error.message}`, 'info-quiet')
})

oscUDP.open()

oscUDP.on('ready', function () {
	logger(`OSC Sending Port Ready. Broadcasting on Port: ${oscPort}`, 'info-quiet')
})

@RegisterAction('58da987d', 'OSC', [
	{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
	{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
	{ fieldName: 'path', fieldLabel: 'Path', fieldType: 'text' },
	{
		fieldName: 'args',
		fieldLabel: 'Arguments',
		fieldType: 'text',
		help: 'Separate multiple argments with a space. Strings must be encapsulated by double quotes.',
	},
])
export class OSC extends Action {
	public run(): void {
		let args = []
		let data = []

		const isNumeric = (string) => /^[+-]?\d+(\.\d+)?$/.test(string)

		if (this.action.data.args !== '') {
			args = this.action.data.args.split(' ')
			let arg: any

			for (let i = 0; i < args.length; i++) {
				// Check if OSC-string
				if (!isNumeric(args[i])) {
					arg = {
						type: 's',
						value: args[i].replace(/"/g, '').replace(/'/g, ''),
					}
					data.push(arg)
				}
				// Check if float32
				else if (args[i].toString().indexOf('.') > -1) {
					arg = {
						type: 'f',
						value: parseFloat(args[i]),
					}
					data.push(arg)
				}
				// No check, assume int32
				else {
					arg = {
						type: 'i',
						value: parseInt(args[i]),
					}
					data.push(arg)
				}
			}
		}

		if (this.action.data.path == '') {
			this.action.data.path = '/'
		}

		logger(
			`Sending OSC Message: ${this.action.data.ip}:${this.action.data.port} ${this.action.data.path} ${this.action.data.args}`,
			'info',
		)
		oscUDP.send({ address: this.action.data.path, args: data }, this.action.data.ip, this.action.data.port)
	}
}
