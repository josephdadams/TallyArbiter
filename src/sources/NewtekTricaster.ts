import { logger } from '..'
import { RegisterTallyInput } from '../_decorators/RegisterTallyInput.decorator'
import { Source } from '../_models/Source'
import { TallyInput } from './_Source'
import net from 'net'
import xml2js from 'xml2js'

@RegisterTallyInput('f2b7dc72', 'Newtek Tricaster', 'Uses Port 5951.', [
	{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
])
export class NewtekTricasterSource extends TallyInput {
	private client: any
	private port = 5951 // Fixed Newtek Tricaster TCP port number
	private tallydata_TC: any[] = []
	constructor(source: Source) {
		super(source)

		this.client = new net.Socket()

		this.client.on('connect', () => {
			let tallyCmd = '<register name="NTK_states"/>'
			this.client.write(tallyCmd + '\n')
			this.connected.next(true)
		})

		this.client.on('data', (data) => {
			logger(`Source: ${source.name}  Tricaster data received.`, 'info-quiet')
			try {
				data = '<data>' + data.toString() + '</data>'

				let parseString = xml2js.parseString

				parseString(data, (error, result) => {
					if (error) {
						//the Tricaster will send a lot of data that will not parse correctly when it first connects
						//console.log('error:' + error);
					} else {
						let shortcut_states = Object.entries(result['data']['shortcut_states'])

						// Loop through the data and set preview and program based on received data.
						// Example input from page 62: https://downloads.newtek.com/LiveProductionSystems/VMC1/Automation%20and%20Integration%20Guide.pdf
						//
						// <shortcut_states>
						//   <shortcut_state name="program_tally" value="INPUT1|BFR2|DDR3" type="" sender="" />
						//   <shortcut_state name="preview_tally" value="INPUT7" type="" sender="" />
						// </shortcut_states>
						//
						// In this example, INPUT1, BFR1, DDR3 are identified as being on Program output, while INPUT7 is on Preview.
						//
						// For testing can the above data been fed into TallyArbiter via the SocketTest v3.0.0 application
						//
						for (const [name, value] of shortcut_states) {
							let shortcut_state = value['shortcut_state']
							for (let j = 0; j < shortcut_state.length; j++) {
								switch (shortcut_state[j]['$'].name) {
									case 'program_tally':
									case 'preview_tally':
										let tallyValue = shortcut_state[j]['$'].value
										let addresses = tallyValue.split('|')
										this.processTricasterTally(source, addresses, shortcut_state[j]['$'].name)
										break
									default:
										break
								}
							}
						}
					}
				})
			} catch (error) {}
		})

		this.client.on('close', () => {
			this.connected.next(false)
		})

		this.client.on('error', function (error) {
			logger(`Source: ${source.name}  Tricaster Connection Error occurred: ${error}`, 'error')
		})

		this.connect()
	}

	public processTricasterTally(sourceId, sourceArray, tallyType?) {
		// Clear the busses before we update based on received Tricast input
		switch (tallyType) {
			case 'preview_tally':
				this.removeBusFromAllAddresses('preview')
				break
			case 'program_tally':
				this.removeBusFromAllAddresses('program')
				break
			default:
				break
		}

		for (let i = 0; i < sourceArray.length; i++) {
			let tricasterSourceFound = false
			for (let j = 0; j < this.tallydata_TC.length; j++) {
				if (this.tallydata_TC[j].sourceId === sourceId) {
					if (this.tallydata_TC[j].address === sourceArray[i]) {
						tricasterSourceFound = true
						break
					}
				}
			}

			if (!tricasterSourceFound) {
				//the source is not in the Tricaster array, we don't know anything about it, so add it to the array
				let tricasterTallyObj: any = {}
				tricasterTallyObj.sourceId = sourceId
				tricasterTallyObj.label = sourceArray[i]
				tricasterTallyObj.address = sourceArray[i]
				tricasterTallyObj.tally4 = 0
				tricasterTallyObj.tally3 = 0
				tricasterTallyObj.tally2 = 0 // PGM
				tricasterTallyObj.tally1 = 0 // PVW
				tricasterTallyObj.preview = 0
				tricasterTallyObj.program = 0
				this.tallydata_TC.push(tricasterTallyObj)
				this.addAddress(sourceArray[i], sourceArray[i])
			}
		}

		for (let i = 0; i < this.tallydata_TC.length; i++) {
			let tricasterSourceFound = false

			// Add preview or program for each used Tricaster input.
			for (let j = 0; j < sourceArray.length; j++) {
				if (this.tallydata_TC[i].sourceId === sourceId) {
					if (this.tallydata_TC[i].address === sourceArray[j]) {
						tricasterSourceFound = true
						//update the tally state because Tricaster is saying this source is in the current bus
						switch (tallyType) {
							case 'preview_tally':
								this.tallydata_TC[i].tally1 = 1
								this.tallydata_TC[i].preview = 1
								this.addBusToAddress(sourceArray[i], 'preview')
								break
							case 'program_tally':
								this.tallydata_TC[i].tally2 = 1
								this.tallydata_TC[i].program = 1
								this.addBusToAddress(sourceArray[i], 'program')
								break
							default:
								break
						}
						break
					}
				}
			}

			// Remove preview or program for each not used Tricaster input, in case it was earlier used.
			if (!tricasterSourceFound) {
				//it is no longer in the bus, mark it as such
				switch (tallyType) {
					case 'preview_tally':
						this.tallydata_TC[i].tally1 = 0
						this.tallydata_TC[i].preview = 0
						this.addBusToAddress(sourceArray[i], 'preview')
						break
					case 'program_tally':
						this.tallydata_TC[i].tally2 = 0
						this.tallydata_TC[i].program = 0
						this.addBusToAddress(sourceArray[i], 'program')
						break
					default:
						break
				}
			}
		}
		this.sendTallyData()
	}

	private connect(): void {
		this.client.connect({ port: this.port, host: this.source.data.ip })
	}

	public reconnect(): void {
		this.connect()
	}

	public exit(): void {
		super.exit()
		let tallyCmd = '<unregister name="NTK_states"/>'
		this.client.write(tallyCmd + '\n')
		this.client.end()
		this.client.destroy()
	}
}
