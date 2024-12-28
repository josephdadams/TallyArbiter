import { GetBusByBusId, logger } from '..'
import { ListenerProvider } from './_ListenerProvider'
import dgram from 'dgram'
import net from 'net'
import { TSLClient } from '../_models/TSLClient'
import { currentConfig } from '../_helpers/config'
import { ConfigTSLClient } from '../_models/ConfigTSLClient'
import { DeviceTallyData } from '../_models/TallyData'
import { Device } from '../_models/Device'

export class TSLListenerProvider extends ListenerProvider {
	public tsl_clients: TSLClient[] = []

	public start() {
		logger('Starting TSL Listener Service.', 'info-quiet')
		logger(
			`Initiating ${currentConfig.tsl_clients.length} TSL Client Connection${this.tsl_clients.length > 1 ? 's' : ''}.`,
			'info',
		)
		for (const tslClient of currentConfig.tsl_clients) {
			logger(`TSL Client: ${tslClient.ip}:${tslClient.port} (${tslClient.transport})`, 'info-quiet')
			this.startTSLClientConnection(tslClient)
		}
		logger(`Finished TSL Client Connections.`, 'info')
	}

	public startTSLClientConnection(configTSLClient: ConfigTSLClient) {
		//this.tsl_clients = this.tsl_clients.filter((t) => t.id == configTSLClient.id);
		const tslClient = { ...configTSLClient, connected: false } as TSLClient
		switch (tslClient.transport) {
			case 'udp':
				logger(
					`TSL Client: ${tslClient.id}  Initiating TSL Client UDP Socket: ${tslClient.ip}:${tslClient.port}`,
					'info-quiet',
				)
				tslClient.socket = dgram.createSocket('udp4')
				tslClient.socket.on('error', (error) => {
					logger(`An error occurred with the connection to ${tslClient.ip}:${tslClient.port}  ${error}`, 'error')
					tslClient.error = true
					if (error.toString().indexOf('ECONNREFUSED') > -1) {
						tslClient.connected = false
					}
					this.emit('updateSockets', 'tsl_clients')
				})
				tslClient.socket.on('connect', () => {
					logger(`TSL Client ${tslClient.id} Connection Established: ${tslClient.ip}:${tslClient.port}`, 'info-quiet')
					tslClient.error = false
					tslClient.connected = true
					this.emit('updateSockets', 'tsl_clients')
				})
				tslClient.socket.on('close', () => {
					if (tslClient) {
						logger(`TSL Client ${tslClient.id} Connection Closed: ${tslClient.ip}:${tslClient.port}`, 'info-quiet')
						tslClient.error = false
						tslClient.connected = false
						this.emit('updateSockets', 'tsl_clients')
					}
				})
				tslClient.connected = true
				break
			case 'tcp':
				logger(
					`TSL Client: ${tslClient.id}  Initiating TSL Client TCP Socket: ${tslClient.ip}:${tslClient.port}`,
					'info-quiet',
				)
				tslClient.socket = new net.Socket()
				tslClient.socket.on('error', (error) => {
					logger(`An error occurred with the connection to ${tslClient.ip}:${tslClient.port}  ${error}`, 'error')
					tslClient.error = true
					if (error.toString().indexOf('ECONNREFUSED') > -1) {
						tslClient.connected = false
					}
					this.emit('updateSockets', 'tsl_clients')
				})
				tslClient.socket.on('connect', () => {
					logger(`TSL Client ${tslClient.id} Connection Established: ${tslClient.ip}:${tslClient.port}`, 'info-quiet')
					tslClient.error = false
					tslClient.connected = true
					this.emit('updateSockets', 'tsl_clients')
				})
				tslClient.socket.on('close', () => {
					if (tslClient) {
						logger(`TSL Client ${tslClient.id} Connection Closed: ${tslClient.ip}:${tslClient.port}`, 'info-quiet')
						tslClient.error = false
						tslClient.connected = false
						this.emit('updateSockets', 'tsl_clients')
					}
				})
				tslClient.socket.connect(parseInt(tslClient.port as string), tslClient.ip)
				break
			default:
				break
		}
		this.tsl_clients.push(tslClient)
	}

	public stopTSLClientConnection(tslClientId) {
		const tslClient = this.tsl_clients.find((t) => t.id == tslClientId)
		switch (tslClient.transport) {
			case 'udp':
				logger(
					`TSL Client: ${tslClientId}  Closing TSL Client UDP Socket: ${tslClient.ip}:${tslClient.port}`,
					'info-quiet',
				)
				tslClient.socket.close()
				break
			case 'tcp':
				logger(
					`TSL Client: ${tslClientId}  Closing TSL Client TCP Socket: ${tslClient.ip}:${tslClient.port}`,
					'info-quiet',
				)
				tslClient.socket.end()
				break
			default:
				break
		}

		this.tsl_clients = this.tsl_clients.filter((t) => t.id !== tslClientId) //remove this one from the internal class array
		this.emit('updateSockets', 'tsl_clients')
	}

	public updateListenerClientsForDevice(currentTallyData: DeviceTallyData, device: Device): void {
		if (!device) {
			return
		}
		let tslAddress = device.tslAddress ? parseInt(device.tslAddress) : -1

		let mode_preview = false
		let mode_program = false

		if (tslAddress !== -1) {
			let bufUMD = Buffer.alloc(18, 0) //ignores spec and pad with 0 for better aligning on Decimator etc
			bufUMD[0] = 0x80 + tslAddress
			bufUMD.write(device.name, 2)

			for (const busId of currentTallyData[device.id]) {
				if (GetBusByBusId(busId).type === 'preview') {
					mode_preview = true
				} else if (GetBusByBusId(busId).type === 'program') {
					mode_program = true
				}
				//could add support for other states here like tally3, tally4, whatever the TSL protocol supports
			}

			let data: any = {}

			if (mode_preview) {
				data.tally1 = 1
			} else {
				data.tally1 = 0
			}

			if (mode_program) {
				data.tally2 = 1
			} else {
				data.tally2 = 0
			}

			data.tally3 = 0
			data.tally4 = 0

			let bufTally = 0x30

			if (data.tally1) {
				bufTally |= 1
			}
			if (data.tally2) {
				bufTally |= 2
			}
			if (data.tally3) {
				bufTally |= 4
			}
			if (data.tally4) {
				bufTally |= 8
			}
			bufUMD[1] = bufTally

			if (this.tsl_clients.length > 0) {
				logger(
					`Sending TSL data for ${device.name} to ${this.tsl_clients.length} client${this.tsl_clients.length > 1 ? 's' : ''}.`,
					'info-quiet',
				)
			}

			for (const tslClient of this.tsl_clients.filter((t) => t.connected)) {
				//logger(`Sending TSL data for ${device.name} to ${tslClient.ip}:${tslClient.port}`, 'info');
				switch (tslClient.transport) {
					case 'udp':
						try {
							tslClient.socket.send(bufUMD, parseInt(tslClient.port as string), tslClient.ip)
						} catch (error) {
							logger(
								`An error occurred sending TSL data for ${device.name} to ${tslClient.ip}:${tslClient.port}  ${error}`,
								'error',
							)
							tslClient.error = true
						}
						break
					case 'tcp':
						try {
							tslClient.socket.write(bufUMD)
						} catch (error) {
							logger(
								`An error occurred sending TSL data for ${device.name} to ${tslClient.ip}:${tslClient.port}  ${error}`,
								'error',
							)
							tslClient.error = true
						}
						break
					default:
						break
				}
			}
		}
	}
}
