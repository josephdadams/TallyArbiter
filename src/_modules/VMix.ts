import net from 'net'
import { version } from 'os'
import { logger } from '..'
import { UsesPort } from '../_decorators/UsesPort.decorator'
import { currentConfig } from '../_helpers/config'
import { uuidv4 } from '../_helpers/uuid'
import { DeviceTallyData } from '../_models/TallyData'
import { ListenerProvider } from './_ListenerProvider'

const VMixPort = 8099

@UsesPort(VMixPort)
export class VMixEmulator extends ListenerProvider {
	private server: net.Server
	public vmix_clients = [] // Clients currently connected to the VMix Emulator
	public vmix_client_data = [] // array of connected Vmix clients

	public start() {
		logger('Starting VMix Emulation Service.', 'info-quiet')
		this.server = net.createServer()

		this.server.on('connection', (socket) => this.handleConnection(socket))

		this.server.listen(VMixPort, () => {
			logger(
				`Finished VMix Emulation Setup. Listening for VMix Tally Connections on TCP Port ${VMixPort}.`,
				'info-quiet',
			)
		})
		this.deleteInactiveListenerClients()
	}

	private handleConnection(socket: net.Socket) {
		let host = this.getHost(socket)
		logger(`New VMix Emulator Connection from ${host}`, 'info')
		socket.write(`VERSION OK ${version}\r\n`)
		socket.on('data', (data) => this.onConnData(socket, data))
		socket.once('close', () => this.onConnClose(socket))
		socket.on('error', (e) => this.onConnError(socket, e))
	}

	private getHost(socket: net.Socket) {
		return socket.remoteAddress + ':' + socket.remotePort
	}

	private onConnData(socket: net.Socket, d: Buffer) {
		//console.log(d);
		const parts = d.toString().split(/\r?\n/)

		if (parts[0] === 'SUBSCRIBE TALLY') {
			this.addVmixListener(socket, this.getHost(socket))
			socket.write('SUBSCRIBE OK TALLY\r\n')
		} else if (parts[0] === 'UNSUBSCRIBE TALLY') {
			socket.write('UNSUBSCRIBE OK TALLY\r\n')
			this.removeVmixListener(this.getHost(socket))
		} else if (parts[0].startsWith('ACTS')) {
			// reacts to ACTS commands, e.g. "ACTS Overlay1" so vMix Listener Devices work correctly (e.g. Hollyland Wireless Tally System)
			const commandParts = parts[0].split(' ')
			const activator = commandParts.length >= 2 ? commandParts[1] : 'Unknown'
			const activator_status = '0'; // static response because tally state is already handled by TALLY OK ##
			const acts_response = 'ACTS OK ${activator} ${activator_status}\r\n'
			socket.write(acts_response)
		} else if (parts[0] === 'QUIT') {
			socket.destroy()
		}
	}
	private onConnClose(socket: net.Socket) {
		const host = this.getHost(socket)
		this.removeVmixListener(host)
		logger(`VMix Emulator Connection from ${host} closed`, 'info')
	}
	private onConnError(socket: net.Socket, err) {
		const host = this.getHost(socket)
		if (err.message === 'This socket has been ended by the other party') {
			logger(`VMix Emulator Connection ${host} taking longer to respond than normal`, 'info-quiet')
			//removeVmixListener(host);
		} else {
			logger(`VMix Emulator Connection ${host} error: ${err.message}`, 'error')
		}
	}

	private addVmixListener(conn, host) {
		let socketId = 'vmix-' + uuidv4()
		//listenerClientId = AddListenerClient(socketId, null, 'vmix', host, new Date().getTime(), false, false);
		conn.listenerClientId = uuidv4()
		conn.host = host
		conn.socketId = socketId
		this.vmix_clients.push(conn)

		//Push to global var
		this.vmix_client_data.push({
			host,
			socketID: socketId,
			inactive: false,
		})
		//console.log(this.vmix_client_data);
		//console.log(this.vmix_client_data.length);
		this.emit('updateSockets', 'vmix_clients')
		logger(`VMix Emulator Connection ${host} subscribed to tally`, 'info')
	}

	private removeVmixListener(host) {
		let socketId = null

		for (let i = 0; i < this.vmix_client_data.length; i++) {
			if (this.vmix_client_data[i].host === host) {
				socketId = this.vmix_client_data[i].socketId
				this.vmix_client_data.splice(i, 1)
			}
		}

		if (socketId !== null) {
			this.deactivateListenerClient(socketId)
		}

		logger(`VMix Emulator Connection ${host} unsubscribed to tally`, 'info')
	}

	private deactivateListenerClient(socketId) {
		for (let i = 0; i < this.vmix_client_data.length; i++) {
			if (this.vmix_client_data[i].socketId === socketId) {
				this.vmix_client_data[i].inactive = true
				this.vmix_client_data[i].datetime_inactive = new Date().getTime()
				let message = `Listener Client Disconnected: ${this.vmix_client_data[i].host.replace('::ffff:', '')} at ${new Date()}`
				this.emit('chatMessage', 'server', null, message)
			}
		}

		//console.log(this.vmix_client_data);
		this.emit('updateSockets', 'vmix_clients')
	}

	private deleteInactiveListenerClients() {
		let changesMade = false
		for (let i = this.vmix_client_data.length - 1; i >= 0; i--) {
			if (this.vmix_client_data[i].inactive === true) {
				let dtNow = new Date().getTime()
				if (dtNow - this.vmix_client_data[i].datetime_inactive > 1000 * 60 * 60) {
					//1 hour
					logger(`Inactive Client removed: ${this.vmix_client_data[i].id}`, 'info')
					this.vmix_client_data.splice(i, 1)
					changesMade = true
				}
			}
		}

		if (changesMade) {
			this.emit('updateSockets', 'vmix_clients')
		}

		setTimeout(() => this.deleteInactiveListenerClients(), 5 * 60 * 1000) // runs every 5 minutes
	}

	public updateListenerClients(currentTallyData: DeviceTallyData): void {
		let vmixTallyString = 'TALLY OK '

		let busId_preview = null
		let busId_program = null

		for (let i = 0; i < currentConfig.bus_options.length; i++) {
			switch (currentConfig.bus_options[i].type) {
				case 'preview':
					busId_preview = currentConfig.bus_options[i].id
					break
				case 'program':
					busId_program = currentConfig.bus_options[i].id
					break
				default:
					break
			}
		}

		for (const [deviceId, busIds] of Object.entries(currentTallyData)) {
			if (busIds.includes(busId_program)) {
				vmixTallyString += '1'
			} else if (busIds.includes(busId_preview)) {
				vmixTallyString += '2'
			} else {
				vmixTallyString += '0'
			}
		}

		vmixTallyString += '\r\n'

		for (let i = 0; i < this.vmix_clients.length; i++) {
			this.vmix_clients[i].write(vmixTallyString)
		}
	}
}
