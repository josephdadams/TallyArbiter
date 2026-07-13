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
		let data = []

		const isNumeric = (string) => /^[+-]?\d+(\.\d+)?$/.test(string)

		if (this.action.data.args !== '') {
			// Quote-aware tokenizer: a double-quoted span (which may contain
			// spaces) is treated as a single argument; everything else is
			// split on whitespace, matching the documented behavior that
			// "Strings must be encapsulated by double quotes."
			const tokens: { value: string; quoted: boolean }[] = []
			const tokenRegex = /"([^"]*)"|(\S+)/g
			let match: RegExpExecArray | null

			while ((match = tokenRegex.exec(this.action.data.args)) !== null) {
				if (match[1] !== undefined) {
					tokens.push({ value: match[1], quoted: true })
				} else {
					tokens.push({ value: match[2], quoted: false })
				}
			}

			let arg: any

			for (let i = 0; i < tokens.length; i++) {
				const { value, quoted } = tokens[i]
				// Check if OSC-string. A quoted argument is always treated as a
				// string, even if its contents look numeric, since quoting is
				// how the user explicitly opts into string type.
				if (quoted || !isNumeric(value)) {
					arg = {
						type: 's',
						value: value.replace(/"/g, '').replace(/'/g, ''),
					}
					data.push(arg)
				}
				// Check if float32
				else if (value.toString().indexOf('.') > -1) {
					arg = {
						type: 'f',
						value: parseFloat(value),
					}
					data.push(arg)
				}
				// No check, assume int32
				else {
					arg = {
						type: 'i',
						value: parseInt(value),
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
