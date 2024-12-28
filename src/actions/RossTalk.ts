import net from 'net'
import { logger } from '..'
import { RegisterAction } from '../_decorators/RegisterAction'
import { Action } from './_Action'

@RegisterAction('4827f903', 'RossTalk', [
	{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
	{ fieldName: 'string', fieldLabel: 'Command', fieldType: 'text' },
])
export class RossTalk extends Action {
	public run(): void {
		try {
			let tcpClient = new net.Socket()
			this.action.data.port = '7788'
			tcpClient.connect(this.action.data.port, this.action.data.ip)

			tcpClient.on('connect', () => {
				tcpClient.write(this.action.data.string + '\r\n')
				tcpClient.end()
				tcpClient.destroy() // kill client after sending data
				logger(`RossTalk sent: ${this.action.data.ip}:${this.action.data.port} : ${this.action.data.string}`, 'info')
			})

			tcpClient.on('error', (error) => {
				logger(`An error occured sending RossTalk: ${error}`, 'error')
			})
		} catch (error) {
			logger(`An error occured sending RossTalk: ${error}`, 'error')
		}
	}
}
