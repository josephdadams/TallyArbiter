import { logger } from '..'
import { RegisterTallyInput } from '../_decorators/RegisterTallyInput.decorator'
import { Source } from '../_models/Source'
import { TallyInput } from './_Source'
import net from 'net'

@RegisterTallyInput('58b6af42', 'VMix', 'Uses Port 8099.', [
	{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
])
export class VMixSource extends TallyInput {
	private client: any
	private port = 8099 // Fixed vMix TCP port number
	//TCP is a byte stream with no message boundaries, so a single vMix line can arrive split
	//across several 'data' events and several lines can arrive coalesced in one event.
	//Invariant: receiveBuffer only ever holds the trailing *incomplete* line; every complete
	//(newline terminated) line is removed from it and processed exactly once.
	private receiveBuffer = ''
	constructor(source: Source) {
		super(source)

		this.client = new net.Socket()

		this.client.on('connect', () => {
			this.receiveBuffer = '' //a reconnect must not inherit a stale partial line

			this.client.write('SUBSCRIBE TALLY\r\n')
			this.client.write('SUBSCRIBE ACTS\r\n')

			this.addAddress('Recording', '{{RECORDING}}')
			this.addAddress('Streaming', '{{STREAMING}}')

			this.connected.next(true)
		})

		this.client.on('data', (data) => {
			logger(`Source: ${source.name}  VMix data received.`, 'info-quiet')

			this.receiveBuffer += data.toString()

			//split off only the complete lines; the last element is either empty (the chunk
			//ended on a newline) or the start of a line that will be continued by a later chunk
			const lines = this.receiveBuffer.split(/\r?\n/)
			this.receiveBuffer = lines.pop()

			for (const line of lines) {
				this.processLine(line.trim())
			}
		})

		this.client.on('close', () => {
			this.receiveBuffer = ''
			this.connected.next(false)
		})

		this.client.on('error', (error) => {
			logger(`Source: ${source.name}  VMix Connection Error occurred: ${error}`, 'error')
		})

		this.connect()
	}

	/** Processes a single complete line received from vMix. */
	private processLine(line: string): void {
		if (!line) {
			return
		}

		// If received data contains TALLY information loop through the
		// data and set preview and program based on received data.
		if (line.startsWith('TALLY OK')) {
			logger(`Source: ${this.source.name}  VMix tally data received.`, 'info-quiet')
			//the character at index 9 onwards is the state of input 1 onwards (inputs are 1-based)
			for (let j = 9; j < line.length; j++) {
				let address = j - 9 + 1
				let value = line.charAt(j)

				this.addAddress(`Input ${address}`, address.toString())
				const busses = []
				if (value === '2') {
					busses.push('preview')
				}
				if (value === '1') {
					busses.push('program')
				}
				this.setBussesForAddress(address.toString(), busses)
			}
			this.sendTallyData()
		} else if (line.startsWith('ACTS OK Recording ')) {
			this.setBussesForAddress('{{RECORDING}}', [])
			if (line.startsWith('ACTS OK Recording 1')) {
				this.setBussesForAddress('{{RECORDING}}', ['program'])
			}
			this.sendTallyData()
		} else if (line.startsWith('ACTS OK Streaming ')) {
			this.setBussesForAddress('{{STREAMING}}', [])
			if (line.startsWith('ACTS OK Streaming 1')) {
				this.setBussesForAddress('{{STREAMING}}', ['program'])
			}
			this.sendTallyData()
		}
		//any other line (SUBSCRIBE OK, VERSION, other ACTS events, ...) is not tally data, so ignore it
	}

	private connect(): void {
		this.client.connect(this.port, this.source.data.ip)
	}

	public reconnect(): void {
		this.connect()
	}

	public exit(): void {
		super.exit()
		this.client.write('QUIT\r\n')
		this.client.end()
		this.client.destroy()
	}
}
