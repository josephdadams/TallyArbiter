import { logger } from '..'
import { RegisterTallyInput } from '../_decorators/RegisterTallyInput.decorator'
import { Source } from '../_models/Source'
import { TallyInput } from './_Source'
import net from 'net'
import dgram from 'dgram'
import { getNetworkInterfaces } from '../_helpers/networkInterfaces'
import { UsesPort } from '../_decorators/UsesPort.decorator'

const sourceTypesPanasonic = [
	{ id: '00', label: 'XPT 1' },
	{ id: '01', label: 'XPT 2' },
	{ id: '02', label: 'XPT 3' },
	{ id: '03', label: 'XPT 4' },
	{ id: '04', label: 'XPT 5' },
	{ id: '05', label: 'XPT 6' },
	{ id: '06', label: 'XPT 7' },
	{ id: '07', label: 'XPT 8' },
	{ id: '08', label: 'XPT 9' },
	{ id: '09', label: 'XPT 10' },
	{ id: '10', label: 'XPT 11' },
	{ id: '11', label: 'XPT 12' },
	{ id: '12', label: 'XPT 13' },
	{ id: '13', label: 'XPT 14' },
	{ id: '14', label: 'XPT 15' },
	{ id: '15', label: 'XPT 16' },
	{ id: '16', label: 'XPT 17' },
	{ id: '17', label: 'XPT 18' },
	{ id: '18', label: 'XPT 19' },
	{ id: '19', label: 'XPT 20' },
	{ id: '20', label: 'XPT 21' },
	{ id: '21', label: 'XPT 22' },
	{ id: '22', label: 'XPT 23' },
	{ id: '23', label: 'XPT 24' },
]

//const PanasonicAVHS410Port = 60020;

//@UsesPort(PanasonicAVHS410Port)
@RegisterTallyInput(
	'7da3b526',
	'Panasonic AV-HS410',
	'Uses port 60020. Make sure to have Multicast enabled on the network',
	[
		{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
		{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
	],
)
export class PanasonicAVHS410Source extends TallyInput {
	private client: any
	private multi: dgram.Socket
	private keepAliveInterval: NodeJS.Timer
	constructor(source: Source) {
		super(source)

		var receivebuffer = ''
		let multicastAddress = '224.0.0.200'
		let multicastInterface = getNetworkInterfaces() // get network interfaces
		let multicastPort = this.source.data.port || 60020

		var STX = String.fromCharCode(0x02)
		var ETX = String.fromCharCode(0x03)

		// Post an array of inputs to the dropdowns
		this.addPanasonicSource()

		// Create sockets
		this.client = new net.Socket()
		this.multi = dgram.createSocket({ type: 'udp4', reuseAddr: true })

		// Register event listeners
		this.client.on('connect', () => {
			this.connected.next(true)
		})

		this.client.on('data', (data) => {
			// Do nothing currently, we only really use the TCP to keep the connection alive
		})

		this.client.on('close', () => {
			this.connected.next(false)
		})

		this.client.on('error', (error) => {
			logger(`Source: ${source.name}  Panasonic AV-HS410 Connection Error occurred: ${error}`, 'error')
		})

		this.multi.on('listening', () => {
			logger(`Source: ${source.name}  Panasonic AV-HS410 Multicast Enabled.`, 'info')
		})

		this.multi.on('message', (message, remote) => {
			var i = 0,
				packet = '',
				offset = 0
			receivebuffer += message

			// If we receve a data package from the unit - Parse it
			while ((i = receivebuffer.indexOf(ETX, offset)) !== -1) {
				packet = receivebuffer.substr(offset, i - offset)
				offset = i + 1

				if (packet.substr(0, 1) == STX) {
					let str_raw = packet.substr(1).toString()
					// Ready for feedbacks on multicast data
					let stri = str_raw.trim() // remove new line, carage return and so on.
					let str = stri.split(':') // Split Commands and data

					let address = parseInt(str[2]) + 1

					// Clear the old input from program
					switch (str[0]) {
						case 'ABST':
							switch (str[1]) {
								case '00': // Bus A
									break
								case '01': // Bus B
									break
								case '02': // PGM
									// Clear the old input from Program Bus
									this.removeBusFromAllAddresses('program')
									// Set new input to Program Bus
									this.addBusToAddress(address.toString(), 'program')
									this.sendTallyData()
									break
								case '03': // PVW
									// Clear the old input from Program Bus
									this.removeBusFromAllAddresses('preview')
									// Set new input to Program Bus
									this.addBusToAddress(address.toString(), 'preview')
									this.sendTallyData()
									break
								case '04': // Key Fill
									break
								case '05': // Key Source
									break
								case '06': // DSK Fill
									break
								case '07': // DSK Source
									break
								case '10': // PinP 1
									break
								case '11': // PinP 2
									break
								case '12': // AUX 1
									break
								case '13': // AUX 2
									break
								case '14': // AUX 3
									break
								case '15': // AUX 4
									break
								default:
									break
							}
							break
						case 'ATST':
							break // Store some data when ATST command is recieved
						case 'SPAT':
							break // Store some data when SPAT command is recieved

						default:
							break
					}
				}
			}
			receivebuffer = receivebuffer.substr(offset)
		})

		this.multi.on('error', function (err) {
			logger(`Source: ${source.name}  Panasonic Multicast Error occurred: ${err.stack}`, 'error')
		})

		// Configure multicast listening.
		this.multi.bind(multicastPort, () => {
			for (let x = 0; x < multicastInterface.length; x++) {
				this.multi.addMembership(multicastAddress, multicastInterface[x].address)
			}
		})

		// Configure keep alive on the TCP port.
		this.keepAliveInterval = setInterval(() => {
			if (this.client !== undefined) {
				this.client.write(STX + 'SPAT:0:00' + ETX)
				// console.log('send: SPAT:0:00')
			} else {
				logger(`Source: ${source.name}  Panasonic AV-HS410 Connection Lost.`, 'info')
			}
		}, 500) // 500 ms keepalive command

		this.connect()
	}

	public addPanasonicSource() {
		for (const input of sourceTypesPanasonic) {
			let address = String(parseInt(input.id) + 1)
			this.addAddress(input.label, address)
			logger(`AV-HS410 Tally Source: ${this.source.id} Added new source: ${input.label}`, 'info-quiet')
		}
	}

	private connect(): void {
		this.client.connect(this.source.data.port, this.source.data.ip)
	}

	public reconnect(): void {
		this.connect()
	}

	public exit(): void {
		super.exit()
		// Close TCP Keep Alive Requests
		if (this.keepAliveInterval) {
			clearInterval(this.keepAliveInterval)
			delete this.keepAliveInterval
		}

		// Close UDP Multicast Interface
		if (this.multi !== undefined) {
			this.multi.close()
			delete this.multi
		}

		this.client.write('QUIT\r\n')
	}
}
