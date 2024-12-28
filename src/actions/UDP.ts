import { logger } from '..'
import { RegisterAction } from '../_decorators/RegisterAction'
import { Action } from './_Action'
import dgram from 'dgram'

@RegisterAction('79e3ce28', 'Generic UDP', [
	{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
	{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
	{ fieldName: 'string', fieldLabel: 'UDP String', fieldType: 'text' },
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
	{
		fieldName: 'type',
		fieldLabel: 'UDP socket family (interface type)',
		fieldType: 'dropdown',
		options: [
			{ id: 'udp4', label: 'IPv4' },
			{ id: 'udp6', label: 'IPv6' },
		],
		optional: true,
	},
])
export class UDP extends Action {
	public run(): void {
		try {
			let sendBuf = Buffer.from(unescape(this.action.data.string) + this.action.data.end, 'latin1')

			if (!this.action.data.type) this.action.data.type = 'udp4'
			let client = dgram.createSocket(this.action.data.type)
			client.on('message', function (msg, info) {})

			client.send(sendBuf, this.action.data.port, this.action.data.ip, function (error) {
				if (!error) {
					logger(
						`Generic UDP sent: ${this.action.data.ip}:${this.action.data.port} : ${this.action.data.string}`,
						'info',
					)
				}
				client.close()
			})
		} catch (error) {
			logger(`An error occured sending the Generic UDP: ${error}`, 'error')
		}
	}
}
