import { GetBusByBusId, logger } from '..'
import { ListenerProvider } from './_ListenerProvider'
import dgram from 'dgram'
import net from 'net'
import TSLUMDv5 from 'tsl-umd-v5'
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

		if (tslAddress == -1) {
			return
		}

		if (this.tsl_clients.length > 0) {
			logger(
				`Sending TSL data for ${device.name} to ${this.tsl_clients.length} client${this.tsl_clients.length > 1 ? 's' : ''}.`,
				'info-quiet',
			)
		}

		for (const tslClient of this.tsl_clients.filter((t) => t.connected)) {
			//logger(`Sending TSL data for ${device.name} to ${tslClient.ip}:${tslClient.port}`, 'info');
			let bufUMD: Buffer

			//if protocol is 3.1, send this, if 5.0, send that
			let tsl31Buffer = this.createTSL31Packet(currentTallyData, device, tslClient)
			let tsl5Buffer = this.createTSL5Packet(currentTallyData, device, tslClient)

			if (tslClient.protocol == '3.1' || tslClient.protocol == undefined) {
				bufUMD = tsl31Buffer
			} else if (tslClient.protocol == '5.0') {
				bufUMD = tsl5Buffer
			}

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

	private roleActive(role: string, isPvw: boolean, isPgm: boolean): boolean {
		if (role === 'pvw') return isPvw
		if (role === 'pgm') return isPgm
		return false
	}

	private getPvwPgmState(currentTallyData: DeviceTallyData, device: Device): { isPvw: boolean; isPgm: boolean } {
		let isPvw = false
		let isPgm = false

		for (const busId of currentTallyData[device.id] ?? []) {
			const bus = GetBusByBusId(busId)
			if (bus?.type === 'preview') isPvw = true
			else if (bus?.type === 'program') isPgm = true
		}

		return { isPvw, isPgm }
	}

	private createTSL31Packet(currentTallyData: DeviceTallyData, device: Device, tslClient: TSLClient): Buffer {
		let tslAddress = device.tslAddress ? parseInt(device.tslAddress) : -1

		let mode_preview = false
		let mode_program = false

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

		// Determine TA state for this device
		const { isPvw, isPgm } = this.getPvwPgmState(currentTallyData, device)

		// Map TA state -> TSL tally bits based on client config
		const opts = tslClient.protocolOptions
		data.tally1 = this.roleActive(opts.tally1 ?? 'pvw', isPvw, isPgm)
		data.tally2 = this.roleActive(opts.tally2 ?? 'pgm', isPvw, isPgm)
		data.tally3 = this.roleActive(opts.tally3 ?? '', isPvw, isPgm)
		data.tally4 = this.roleActive(opts.tally4 ?? '', isPvw, isPgm)

		// Byte 1: bits 7-6 brightness, bits 0-3 tally 1-4
		const brightness = (opts.brightness ?? 3) & 0b11

		let byte1 = 0
		byte1 |= brightness << 6

		if (data.tally1) byte1 |= 0b0001
		if (data.tally2) byte1 |= 0b0010
		if (data.tally3) byte1 |= 0b0100
		if (data.tally4) byte1 |= 0b1000

		bufUMD[1] = byte1

		return bufUMD
	}

	private roleToTSL5Color(role: string, isPvw: boolean, isPgm: boolean): number {
		if (role === 'pgm') return isPgm ? 1 : 0
		if (role === 'pvw') return isPvw ? 2 : 0
		return 0
	}

	private createTSL5Packet(currentTallyData: DeviceTallyData, device: Device, tslClient: TSLClient): Buffer {
		const opts = tslClient.protocolOptions

		let isPvw = false
		let isPgm = false
		for (const busId of currentTallyData[device.id] ?? []) {
			const bus = GetBusByBusId(busId)
			if (bus?.type === 'preview') isPvw = true
			else if (bus?.type === 'program') isPgm = true
		}

		const lh_tally = this.roleToTSL5Color(opts.lh_tally, isPvw, isPgm)
		const rh_tally = this.roleToTSL5Color(opts.rh_tally, isPvw, isPgm)
		const text_tally = this.roleToTSL5Color(opts.text_tally, isPvw, isPgm)

		let sequence: boolean | false = false
		if (opts.sequence === 'ON') sequence = true

		const tally: any = {
			index: device.tslAddress ? parseInt(device.tslAddress, 10) : 1,
			display: {
				lh_tally,
				rh_tally,
				text_tally,
				brightness: opts.brightness ?? '3',
				text: device.name,
			},
		}

		const umd = new TSLUMDv5()

		const bufUMD = umd.constructPacket(tally, sequence)

		//console.log(bufUMD)

		return bufUMD
	}
}
