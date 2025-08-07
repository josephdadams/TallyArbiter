import { RegisterTallyInput } from '../_decorators/RegisterTallyInput.decorator'
import { FreePort, UsePort } from '../_decorators/UsesPort.decorator'
import { Source } from '../_models/Source'
import { TallyInput } from './_Source'
import http from 'http'
import { logger } from '..'

@RegisterTallyInput('cf51e3c9', 'Incoming Webhook', '', [
	{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
	{ fieldName: 'path', fieldLabel: 'Webhook path', fieldType: 'text' },
])
export class IncomingWebhookSource extends TallyInput {
	private server: http.Server

	constructor(source: Source) {
		super(source)
		const port = source.data.port || 8080
		const path = source.data.path || '/webhook'

		UsePort(port, this.source.id)

		this.server = http.createServer((req, res) => {
			if (req.method === 'POST' && req.url === path) {
				let body = ''
				req.on('data', chunk => {
					body += chunk
				})
				req.on('end', () => {
					try {
						interface IncomingWebhookData {
							[address: string]: string[]
						}
						const data: IncomingWebhookData = JSON.parse(body)

						for (const address in data) {
							if (!this.addresses.getValue().filter((a) => a.address === address).length) {
								this.addAddress(address, address)
							}

							if (data.hasOwnProperty(address)) {
								const busses = data[address]

								this.setBussesForAddress(address, busses)
							}
						}
						this.sendTallyData()

						res.writeHead(200)
						res.end('OK')

					} catch (e) {
						res.writeHead(400)
						res.end('Invalid JSON')
					}
				})
			} else {
				res.writeHead(404)
				res.end('Not found')
			}
		})

		this.server.listen(port, () => {
			this.connected.next(true)
			logger(`Incoming Webhook listening on port ${port}${path}`, 'info')
		})

		this.server.on('error', (err) => {
			logger(`Incoming Webhook error: ${err}`, 'error')
		})
	}

	public exit(): void {
		super.exit()
		this.server.close()
		FreePort(this.source.data.port, this.source.id)
		this.connected.next(false)
	}
}