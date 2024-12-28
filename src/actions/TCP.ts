import { logger } from '..'
import { RegisterAction } from '../_decorators/RegisterAction'
import { Action } from './_Action'
import net from 'net'

@RegisterAction('79e3ce27', 'Generic TCP', [
	{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
	{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
	{ fieldName: 'string', fieldLabel: 'TCP String', fieldType: 'text' },
	{
		fieldName: 'end',
		fieldLabel: 'End Character',
		fieldType: 'dropdown',
		options: [
			{ id: '', label: 'None' },
			{ id: '\n', label: 'LF - \\n' },
			{ id: '\r\n', label: 'CRLF - \\r\\n' },
			{ id: '\r', label: 'CR - \\r' },
			{ id: '\x00', label: 'NULL - \\x00' },
		],
	},
])
export class TCP extends Action {
	public run(): void {
		try {
			let tcpClient = new net.Socket()
			tcpClient.connect(this.action.data.port, this.action.data.ip)

			tcpClient.on('connect', () => {
				let sendBuf = Buffer.from(unescape(this.action.data.string) + this.action.data.end, 'latin1')
				tcpClient.write(sendBuf)
				tcpClient.end()
				tcpClient.destroy() // kill client after sending data
				logger(`Generic TCP sent: ${this.action.data.ip}:${this.action.data.port} : ${this.action.data.string}`, 'info')
			})

			tcpClient.on('error', (error) => {
				logger(`An error occured sending the Generic TCP: ${error}`, 'error')
			})
		} catch (error) {
			logger(`An error occured sending the Generic TCP: ${error}`, 'error')
		}
	}
}
