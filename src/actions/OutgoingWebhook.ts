import axios from 'axios'
import { logger } from '..'
import { RegisterAction } from '../_decorators/RegisterAction'
import { Action } from './_Action'

@RegisterAction('ffe2b0b6', 'Outgoing Webhook', [
	{
		fieldName: 'protocol',
		fieldLabel: 'Protocol',
		fieldType: 'dropdown',
		options: [
			{ id: 'http://', label: 'HTTP' },
			{ id: 'https://', label: 'HTTPS' },
		],
	},
	{ fieldName: 'ip', fieldLabel: 'IP Address/URL', fieldType: 'text' },
	{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
	{ fieldName: 'path', fieldLabel: 'Path', fieldType: 'text' },
	{
		fieldName: 'method',
		fieldLabel: 'Method',
		fieldType: 'dropdown',
		options: [
			{ id: 'GET', label: 'GET' },
			{ id: 'POST', label: 'POST' },
		],
	},
	{
		fieldName: 'contentType',
		fieldLabel: 'Content-Type',
		fieldType: 'dropdown',
		options: [
			{ id: 'application/json', label: 'application/json' },
			{ id: 'application/xml', label: 'application/xml' },
			{ id: 'application/x-www-form-urlencoded', label: 'x-www-form-urlencoded' },
			{ id: 'text/plain', label: 'Text/Plain' },
			{ id: '', label: 'Default' },
		],
	},
	{ fieldName: 'postdata', fieldLabel: 'POST Data', fieldType: 'text' },
])
export class OutgoingWebhook extends Action {
	public run(): void {
		try {
			let path = this.action.data.path
				? this.action.data.path.startsWith('/')
					? this.action.data.path
					: '/' + this.action.data.path
				: ''
			this.action.data.protocol = this.action.data.protocol || 'http://'

			this.action.data.port = this.action.data.port
				? this.action.data.port === ''
					? '80'
					: this.action.data.port
				: '80' //explicitly set the port to 80 if they did not specify

			let options = {
				method: this.action.data.method,
				url: this.action.data.protocol + this.action.data.ip + ':' + this.action.data.port + path,
			} as any

			options.headers = options.headers || {}

			this.action.data.contentType = this.action.data.contentType || ''
			if (this.action.data.contentType !== '') {
				options.headers['Content-Type'] = this.action.data.contentType
			}

			if (this.action.data.method === 'POST') {
				if (this.action.data.postdata !== '') {
					options.data = this.action.data.postdata
				}
			}

			logger('Outgoing Webhook Options:', 'info-quiet')
			logger(JSON.stringify(options), 'info-quiet')
			axios(options)
				.then(function (response) {
					logger('Outgoing Webhook triggered.', 'info')
					if (response.data) {
						logger('Response received:', 'info')
						logger(JSON.stringify(response.data), 'info')
					}
				})
				.catch(function (error) {
					logger(`An error occured triggering the Outgoing Webhook: ${error}`, 'error')
				})
		} catch (error) {
			logger(`An error occured sending the Outgoing Webhook: ${error}`, 'error')
		}
	}
}
