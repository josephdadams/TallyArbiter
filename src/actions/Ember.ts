import { EmberClient } from 'node-emberplus/lib/client/ember-client'
import { logger } from '..'
import { RegisterAction } from '../_decorators/RegisterAction'
import { Action } from './_Action'
import { EmberClientEvent } from 'node-emberplus'

@RegisterAction('48c73ee4', 'Ember+', [
	{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
	{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
	{ fieldName: 'path', fieldLabel: 'Ember Path', fieldType: 'text' },
	{ fieldName: 'value', fieldLabel: 'Value', fieldType: 'bool' },
])
export class Ember extends Action {
	// to prevent the lag of connecting to Ember+, we will store a dictionary of all Ember+ connections
	// keyed on the IP:port.  and a similar connection status in an identical dictionary.

	// A string or number "path" for the Ember+ parameter to be set must be found using Ember+ Viewer
	// or a similar tool.  This has been tested on a Lawo 6.4.0.19 audio cosole and known to be working
	// vGPIs are found in _3/_70/
	// that path corresponds to the descriptions "Signals/GVR"
	// In Lawo 6.4, the ember tree is broken up by HLSD numbers
	// In Lawo 10.x, virtual GPI/O are defined all together in the tree and can be found by name more easily.
	// NOTE:  The parameter value being set by this module is designed to be of a boolean type or used
	// like a boolean.  An int64 type Ember+ element is fine, so long as the use is 0/1 logic similar to C
	// code.  MCX 6.4.x uses an int64 value for virtul GPI/O.  MCX 10.x uses an actual boolean type.
	// this code is compatible with both.  However, if you intend to set a string value, the results could be
	// unpredictable.  This code might need to be refactored if string support is required in the future.
	private static emberConnections = {}
	private static emberConnectionStatus = {}

	private getConnection() {
		const connection = `${this.action.data.ip}:${this.action.data.port}`
		return Ember.emberConnections[connection]
	}

	private isConnected() {
		const connection = `${this.action.data.ip}:${this.action.data.port}`
		return Ember.emberConnectionStatus[connection]
	}

	private newConnection() {
		logger(`Ember+ Creating new connection for ${this.action.data.ip}:${this.action.data.port}`)
		const connection = `${this.action.data.ip}:${this.action.data.port}`
		Ember.emberConnections[connection] = new EmberClient({
			host: this.action.data.ip,
			port: this.action.data.port,
		})
			.on(EmberClientEvent.ERROR, (e) => {
				logger(`Ember+ protocol error: ${e}`, 'error')
			})
			.on(EmberClientEvent.DISCONNECTED, async (e) => {
				Ember.emberConnectionStatus[connection] = false
				logger(`Ember+ client disconnected - reconnecting: erorr: ${e}`)
				await this.getConnection().connectAsync()
			})
			.on(EmberClientEvent.CONNECTED, () => {
				logger(`Ember+ Connected.`)
				Ember.emberConnectionStatus[connection] = true
			})
			.on(EmberClientEvent.CONNECTING, () => {
				logger(`Ember+ Connecting.`)
				Ember.emberConnectionStatus[connection] = false
			})
	}

	private connectionExists() {
		const connection = `${this.action.data.ip}:${this.action.data.port}`
		return connection in Ember.emberConnections
	}

	private async connect() {
		logger(`Ember+ Connecting to ${this.action.data.ip}:${this.action.data.port}`)
		try {
			await this.getConnection().connectAsync()
		} catch (error) {
			logger(`Ember+ connection error: ${error}`, 'error')
		}
	}

	private async setGPI() {
		if (!this.isConnected) {
			logger(`Ember+ error: not connected.  Ignoring request.`, 'error')
			return
		}

		logger(
			`Ember+ sending message ${this.action.data.value} to ${this.action.data.ip}:${this.action.data.port} on path ${this.action.data.path}`,
		)
		try {
			var node = await this.getConnection().getElementByPathAsync(this.action.data.path)

			// since a boolean value results in a checkbox in the HTML admin page, we don't always get a value:false in the json.
			// if the value is undefined we will assume it should be "false"
			var emberValue = false
			if (this.action.data.value === undefined) {
				emberValue = false
			} else {
				emberValue = this.action.data.value
			}

			await this.getConnection().setValueAsync(node, emberValue)
		} catch (error) {
			logger(`Ember+ error, giving up sending: ${error}`, 'error')
		}
	}

	public run(): void {
		// first check to see if this client exists, if not create it
		if (!this.connectionExists()) {
			logger(`Ember+ Creating new connection.`)
			try {
				this.newConnection()
				this.connect()
			} catch (error) {
				logger(`Ember+ Caught error trying to create new connection: ${error}`, 'error')
			}
		}

		// send message
		try {
			this.setGPI()
		} catch (error) {
			logger(`Ember+ An error occured sending Ember+: ${error}`, 'error')
		}
	}
}
