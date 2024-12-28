import { device_sources, logger } from '..'
import { currentConfig } from '../_helpers/config'
import { RegisterTallyInput } from '../_decorators/RegisterTallyInput.decorator'
import { FreePort, UsePort } from '../_decorators/UsesPort.decorator'
import { Source } from '../_models/Source'
import { TallyInputConfigField } from '../_types/TallyInputConfigField'
import { TallyInput } from './_Source'
import net from 'net'
import dgram from 'dgram'

const CTPbusses = [
	{ address: '1', bus: 'me1', name: 'ME 1', type: 'me' },
	{ address: '2', bus: 'me2', name: 'ME 2', type: 'me' },
	{ address: '3', bus: 'me3', name: 'ME 3', type: 'me' },
	{ address: '4', bus: 'me4', name: 'ME 4', type: 'me' },
	{ address: '1', bus: 'output1', name: 'Output 1', type: 'aux', busId: '12c8d699' }, //aux 1
	{ address: '2', bus: 'output2', name: 'Output 2', type: 'aux', busId: '0449b0c7' }, //aux 2
	{ address: '3', bus: 'output3', name: 'Output 3', type: 'aux', busId: '5d94f273' }, //aux 3
	{ address: '4', bus: 'output4', name: 'Output 4', type: 'aux', busId: '77ffb605' }, //aux 4
	{ address: '5', bus: 'output5', name: 'Output 5', type: 'aux', busId: '09d4975d' }, //aux 5
	{ address: '6', bus: 'output6', name: 'Output 6', type: 'aux', busId: 'e2c2e192' }, //aux 6
	{ address: '7', bus: 'output7', name: 'Output 7', type: 'aux', busId: '734f7395' }, //aux 7
	{ address: '8', bus: 'output8', name: 'Output 8', type: 'aux', busId: '3011d34a' }, //aux 8
	{ address: '9', bus: 'output9', name: 'Output 9', type: 'aux', busId: 'f3b3b3b3' }, //aux 9
	{ address: '10', bus: 'output10', name: 'Output 10', type: 'aux' },
	{ address: '11', bus: 'output11', name: 'Output 11', type: 'aux' },
	{ address: '12', bus: 'output12', name: 'Output 12', type: 'aux' },
	{ address: '13', bus: 'output13', name: 'Output 13', type: 'aux' },
	{ address: '14', bus: 'output14', name: 'Output 14', type: 'aux' },
	{ address: '15', bus: 'output15', name: 'Output 15', type: 'aux' },
	{ address: '16', bus: 'output16', name: 'Output 16', type: 'aux' },
	{ address: '17', bus: 'output17', name: 'Output 17', type: 'aux' },
	{ address: '18', bus: 'output18', name: 'Output 18', type: 'aux' },
	{ address: '19', bus: 'output19', name: 'Output 19', type: 'aux' },
	{ address: '20', bus: 'output20', name: 'Output 20', type: 'aux' },
	{ address: '21', bus: 'output21', name: 'Output 21', type: 'aux' },
	{ address: '22', bus: 'output22', name: 'Output 22', type: 'aux' },
	{ address: '23', bus: 'output23', name: 'Output 23', type: 'aux' },
	{ address: '24', bus: 'output24', name: 'Output 24', type: 'aux' },
	{ address: '25', bus: 'output25', name: 'Output 25', type: 'aux' },
	{ address: '26', bus: 'output26', name: 'Output 26', type: 'aux' },
	{ address: '27', bus: 'output27', name: 'Output 27', type: 'aux' },
	{ address: '28', bus: 'output28', name: 'Output 28', type: 'aux' },
	{ address: '29', bus: 'output29', name: 'Output 29', type: 'aux' },
	{ address: '30', bus: 'output30', name: 'Output 30', type: 'aux' },
	{ address: '31', bus: 'output31', name: 'Output 31', type: 'aux' },
	{ address: '32', bus: 'output32', name: 'Output 32', type: 'aux' },
	{ address: '33', bus: 'output33', name: 'Output 33', type: 'aux' },
	{ address: '34', bus: 'output34', name: 'Output 34', type: 'aux' },
	{ address: '35', bus: 'output35', name: 'Output 35', type: 'aux' },
	{ address: '36', bus: 'output36', name: 'Output 36', type: 'aux' },
	{ address: '37', bus: 'output37', name: 'Output 37', type: 'aux' },
	{ address: '38', bus: 'output38', name: 'Output 38', type: 'aux' },
	{ address: '39', bus: 'output39', name: 'Output 39', type: 'aux' },
	{ address: '40', bus: 'output40', name: 'Output 40', type: 'aux' },
	{ address: '41', bus: 'output41', name: 'Output 41', type: 'aux' },
	{ address: '42', bus: 'output42', name: 'Output 42', type: 'aux' },
	{ address: '43', bus: 'output43', name: 'Output 43', type: 'aux' },
	{ address: '44', bus: 'output44', name: 'Output 44', type: 'aux' },
	{ address: '45', bus: 'output45', name: 'Output 45', type: 'aux' },
	{ address: '46', bus: 'output46', name: 'Output 46', type: 'aux' },
	{ address: '47', bus: 'output47', name: 'Output 47', type: 'aux' },
	{ address: '48', bus: 'output48', name: 'Output 48', type: 'aux' },
]

const CTPbussesRossVision = [
	{ address: '1', bus: 'me1', name: 'ME 1', type: 'me' },
	{ address: '2', bus: 'me2', name: 'ME 2', type: 'me' },
	{ address: '3', bus: 'me3', name: 'ME 3', type: 'me' },
	{ address: '4', bus: 'me4', name: 'ME 4', type: 'me' },
	{ address: '1', bus: 'output1', name: 'Aux 1:1', type: 'aux', busId: '12c8d699' }, //aux 1
	{ address: '2', bus: 'output2', name: 'Aux 1:2', type: 'aux', busId: '0449b0c7' }, //aux 2
	{ address: '3', bus: 'output3', name: 'Aux 1:3', type: 'aux', busId: '5d94f273' }, //aux 3
	{ address: '4', bus: 'output4', name: 'Aux 1:4', type: 'aux', busId: '77ffb605' }, //aux 4
	{ address: '5', bus: 'output5', name: 'PGM', type: 'aux' },
	{ address: '6', bus: 'output6', name: 'PVW', type: 'aux' },
	{ address: '7', bus: 'output7', name: 'Clean', type: 'aux' },
	{ address: '8', bus: 'output8', name: 'Aux 1:5', type: 'aux', busId: '09d4975d' }, //aux 5
	{ address: '9', bus: 'output9', name: 'Aux 1:6', type: 'aux', busId: 'e2c2e192' }, //aux 6
	{ address: '10', bus: 'output10', name: 'Aux 1:7', type: 'aux', busId: '734f7395' }, //aux 7
	{ address: '11', bus: 'output11', name: 'Aux 1:8', type: 'aux', busId: '3011d34a' }, //aux 8
	{ address: '12', bus: 'output12', name: 'Aux 2:1', type: 'aux' },
	{ address: '13', bus: 'output13', name: 'Aux 2:2', type: 'aux' },
	{ address: '14', bus: 'output14', name: 'Aux 2:3', type: 'aux' },
	{ address: '15', bus: 'output15', name: 'Aux 2:4', type: 'aux' },
	{ address: '16', bus: 'output16', name: 'Aux 2:5', type: 'aux' },
	{ address: '17', bus: 'output17', name: 'Aux 2:6', type: 'aux' },
	{ address: '18', bus: 'output18', name: 'Aux 2:7', type: 'aux' },
	{ address: '19', bus: 'output19', name: 'Aux 2:8', type: 'aux' },
	{ address: '20', bus: 'output20', name: 'Aux 3:1', type: 'aux' },
	{ address: '21', bus: 'output21', name: 'Aux 3:2', type: 'aux' },
	{ address: '22', bus: 'output22', name: 'Aux 3:3', type: 'aux' },
	{ address: '23', bus: 'output23', name: 'Aux 3:4', type: 'aux' },
	{ address: '24', bus: 'output24', name: 'Aux 3:5', type: 'aux' },
	{ address: '25', bus: 'output25', name: 'Aux 3:6', type: 'aux' },
	{ address: '26', bus: 'output26', name: 'Aux 3:7', type: 'aux' },
	{ address: '27', bus: 'output27', name: 'Aux 3:8', type: 'aux' },
	{ address: '28', bus: 'output28', name: 'Aux 4:1', type: 'aux' },
	{ address: '29', bus: 'output29', name: 'Aux 4:2', type: 'aux' },
	{ address: '30', bus: 'output30', name: 'Aux 4:3', type: 'aux' },
	{ address: '31', bus: 'output31', name: 'Aux 4:4', type: 'aux' },
	{ address: '32', bus: 'output32', name: 'Aux 4:5', type: 'aux' },
	{ address: '33', bus: 'output33', name: 'Aux 4:6', type: 'aux' },
	{ address: '34', bus: 'output34', name: 'Aux 4:7', type: 'aux' },
	{ address: '35', bus: 'output35', name: 'Aux 4:8', type: 'aux' },
	{ address: '36', bus: 'output36', name: 'Aux 5:1', type: 'aux' },
	{ address: '37', bus: 'output37', name: 'Aux 5:2', type: 'aux' },
	{ address: '38', bus: 'output38', name: 'Aux 5:3', type: 'aux' },
	{ address: '39', bus: 'output39', name: 'Aux 5:4', type: 'aux' },
	{ address: '40', bus: 'output40', name: 'Aux 5:5', type: 'aux' },
	{ address: '41', bus: 'output41', name: 'Aux 5:6', type: 'aux' },
	{ address: '42', bus: 'output42', name: 'Aux 5:7', type: 'aux' },
	{ address: '43', bus: 'output43', name: 'Aux 5:8', type: 'aux' },
	{ address: '44', bus: 'output44', name: 'Aux 6:1', type: 'aux' },
	{ address: '45', bus: 'output45', name: 'Aux 6:2', type: 'aux' },
	{ address: '46', bus: 'output46', name: 'Aux 6:3', type: 'aux' },
	{ address: '47', bus: 'output47', name: 'Aux 6:4', type: 'aux' },
	{ address: '48', bus: 'output48', name: 'Aux 6:5', type: 'aux' },
]

const CTPSourcesToBusses = [
	{ sourceId: 'b4f626a6', busses: CTPbusses },
	{ sourceId: '9501c3fc', busses: CTPbussesRossVision },
]

const CTPFields: TallyInputConfigField[] = [
	{
		fieldName: 'transport_type',
		fieldLabel: 'Transport Type',
		fieldType: 'dropdown',
		options: [
			{ id: 'udp', label: 'UDP' },
			{ id: 'tcp', label: 'TCP' },
		],
	},
	{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
]

@RegisterTallyInput('b4f626a6', 'GV Contribution Tally', '', CTPFields, CTPbusses)
@RegisterTallyInput('9501c3fc', 'Ross Vision (Contribution Tally)', '', CTPFields, CTPbussesRossVision)
export class CTPSource extends TallyInput {
	private CTPtallydata = []
	private server: any
	private CTPbusArray: any[]
	constructor(source: Source) {
		super(source)

		let port = source.data.port

		UsePort(port, this.source.id)

		this.CTPbusArray = CTPSourcesToBusses.find((obj) => obj.sourceId === this.source.sourceTypeId)?.busses

		if (!this.CTPbusArray) {
			logger('Contribution Tally Source: No busses found for source ID ' + this.source.id, 'error')
			return
		}

		if (source.data.transport_type === 'udp') {
			this.server = dgram.createSocket({ type: 'udp4', reuseAddr: true })

			this.server.on('message', (data) => {
				this.processCTPData(data)
			})

			this.server.on('listening', function () {
				var address = this.server.address()
				console.log('listening on :' + address.address + ':' + address.port)
			})

			this.server.bind(port)
			this.connected.next(true) //just assume we're connected if UDP
		} else {
			this.server = net
				.createServer((socket) => {
					socket.on('connect', () => {
						this.connected.next(true) //set connected to true when a connection is made
					})

					socket.on('data', (data) => {
						this.processCTPData(data)
					})

					socket.on('close', () => {
						this.connected.next(false)
					})
				})
				.listen(port, () => {
					this.connected.next(true)
				})
		}
	}

	private processCTPData(data: Buffer) {
		const sections = this.parseHexData(data.toString('hex'))

		//parseHexData will call the various other functions (parseMEContribution, parseExternalProcContribution, etc) and return an array of objects based on the command code

		sections.forEach((section, index) => {
			switch (section.commandCode) {
				case 0x8: // ME Contribution
					this.processTally('me', section.data)
					break
				case 0x9: // External Proc Contribution
					//console.log("External Proc Contribution", section);
					break
				case 0xa: // Still Store Contribution
					//console.log("Still Store Contribution", section);
					break
				case 0xb: // Outputs Status
					this.processTally('output', section.data)
					break
				case 0xc: // Source Name
					this.renameAddress(
						section.data.sourceId.toString(),
						section.data.sourceId.toString(),
						section.data.sourceId.toString() + ': ' + section.data.name,
					)
					//console.log(section.data);
					break
				case 0xd: // Update
					//console.log("Update", section);
					break
				default:
					//console.log("Unknown Command", section);
					break
			}
		})

		this.sendTallyData() // send the tally data now that it has all been processed (prevents multiple sends)
	}

	private parseHexData(hexData: string) {
		const commandCodeNames = {
			0x8: 'ME Contribution',
			0x9: 'External Proc Contribution',
			0xa: 'Still Store Contribution',
			0xb: 'Outputs Status',
			0xc: 'Source Name',
			0xd: 'Update',
			0xe: 'Unused',
			0xf: 'Unused',
		}

		const sections = []
		const hexArray = hexData.match(/.{1,2}/g) // Split the string into pairs of two characters
		let currentSection = []
		let commandCode = null
		let instanceID = null

		hexArray.forEach((byte, index) => {
			const byteValue = parseInt(byte, 16)
			const firstNibble = (byteValue & 0xf0) >> 4 // Command code (first half)
			const secondNibble = byteValue & 0x0f // Instance ID (second half)

			// If the byte is large, it could be a command code (and likely repeated)
			if (byteValue > 128 && index < hexArray.length - 1 && byte === hexArray[index + 1]) {
				// Save the current section if there is one
				if (currentSection.length > 0) {
					sections.push({ commandCode, instanceID, data: currentSection })
				}
				// Start a new section with this byte as the command code
				commandCode = firstNibble
				instanceID = secondNibble
				currentSection = []
				hexArray[index + 1] = null // Skip the next byte since it's the same
			} else if (byte !== null) {
				currentSection.push(byte)
			}
		})

		// Push the last section if it exists
		if (currentSection.length > 0) {
			sections.push({ commandCode, instanceID, data: currentSection })
		}

		return sections.map((section) => {
			const commandName = commandCodeNames[section.commandCode] || 'Unknown Command'

			let parsedData
			switch (section.commandCode) {
				case 0x8: // ME Contribution
					parsedData = this.parseMEContribution(section.data, section.instanceID)
					break
				case 0x9: // External Proc Contribution
					parsedData = this.parseExternalProcContribution(section.data)
					break
				case 0xa: // Still Store Contribution
					parsedData = this.parseStillStoreContribution(section.data)
					break
				case 0xb: // Outputs Status
					parsedData = this.parseOutputsStatus(section.data, section.instanceID)
					break
				case 0xc: // Source Name
					parsedData = this.parseSourceName(section.data, section.instanceID)
					break
				case 0xd: // Update
					parsedData = this.parseUpdate(section.data)
					break
				default:
					parsedData = { rawData: section.data }
					break
			}

			return {
				commandCode: section.commandCode,
				commandName,
				instanceID: section.instanceID,
				data: parsedData,
			}
		})
	}

	private parseMEContribution(data, me_id: number) {
		//23 bytes total

		//first byte is the key 1 fill source (value between 1-128)
		let key1_fill = parseInt(data[0], 16)

		//second byte is the keyer buses in use, 8 bits, one bit for each keyer 1-4 cut/fill
		let key4_cut_in_use = (parseInt(data[1], 16) & 0x01) >> 0
		let key4_fill_in_use = (parseInt(data[1], 16) & 0x02) >> 1
		let key3_cut_in_use = (parseInt(data[1], 16) & 0x04) >> 2
		let key3_fill_in_use = (parseInt(data[1], 16) & 0x08) >> 3
		let key2_cut_in_use = (parseInt(data[1], 16) & 0x10) >> 4
		let key2_fill_in_use = (parseInt(data[1], 16) & 0x20) >> 5
		let key1_cut_in_use = (parseInt(data[1], 16) & 0x40) >> 6
		let key1_fill_in_use = (parseInt(data[1], 16) & 0x80) >> 7

		//third byte is the key 1 cut source (value between 1-128)
		let key1_cut = parseInt(data[2], 16)

		//fourth byte is PGM A contribution flag, 8 bits, 4 keys, plus 2 utils, B, and A
		let pgm_a_key4 = (parseInt(data[3], 16) & 0x01) >> 0
		let pgm_a_key3 = (parseInt(data[3], 16) & 0x02) >> 1
		let pgm_a_key2 = (parseInt(data[3], 16) & 0x04) >> 2
		let pgm_a_key1 = (parseInt(data[3], 16) & 0x08) >> 3
		let pgm_a_utility2 = (parseInt(data[3], 16) & 0x10) >> 4
		let pgm_a_utility1 = (parseInt(data[3], 16) & 0x20) >> 5
		let pgm_a_b = (parseInt(data[3], 16) & 0x40) >> 6
		let pgm_a_a = (parseInt(data[3], 16) & 0x80) >> 7

		//fifth byte is the key 2 fill source (value between 1-128)
		let key2_fill = parseInt(data[4], 16)

		//sixth byte is the PGM B contribution flag, 8 bits, 4 keys, plus 2 utils, B, and A
		let pgm_b_key4 = (parseInt(data[5], 16) & 0x01) >> 0
		let pgm_b_key3 = (parseInt(data[5], 16) & 0x02) >> 1
		let pgm_b_key2 = (parseInt(data[5], 16) & 0x04) >> 2
		let pgm_b_key1 = (parseInt(data[5], 16) & 0x08) >> 3
		let pgm_b_utility2 = (parseInt(data[5], 16) & 0x10) >> 4
		let pgm_b_utility1 = (parseInt(data[5], 16) & 0x20) >> 5
		let pgm_b_b = (parseInt(data[5], 16) & 0x40) >> 6
		let pgm_b_a = (parseInt(data[5], 16) & 0x80) >> 7

		//seventh byte is the key 2 cut source (value between 1-128)
		let key2_cut = parseInt(data[6], 16)

		//eighth byte is the PGM C contribution flag, 8 bits, 4 keys, plus 2 utils, B, and A
		let pgm_c_key4 = (parseInt(data[7], 16) & 0x01) >> 0
		let pgm_c_key3 = (parseInt(data[7], 16) & 0x02) >> 1
		let pgm_c_key2 = (parseInt(data[7], 16) & 0x04) >> 2
		let pgm_c_key1 = (parseInt(data[7], 16) & 0x08) >> 3
		let pgm_c_utility2 = (parseInt(data[7], 16) & 0x10) >> 4
		let pgm_c_utility1 = (parseInt(data[7], 16) & 0x20) >> 5
		let pgm_c_b = (parseInt(data[7], 16) & 0x40) >> 6
		let pgm_c_a = (parseInt(data[7], 16) & 0x80) >> 7

		//ninth byte is the key 3 fill source (value between 1-128)
		let key3_fill = parseInt(data[8], 16)

		//tenth byte is the PGM D contribution flag, 8 bits, 4 keys, plus 2 utils, B, and A
		let pgm_d_key4 = (parseInt(data[9], 16) & 0x01) >> 0
		let pgm_d_key3 = (parseInt(data[9], 16) & 0x02) >> 1
		let pgm_d_key2 = (parseInt(data[9], 16) & 0x04) >> 2
		let pgm_d_key1 = (parseInt(data[9], 16) & 0x08) >> 3
		let pgm_d_utility2 = (parseInt(data[9], 16) & 0x10) >> 4
		let pgm_d_utility1 = (parseInt(data[9], 16) & 0x20) >> 5
		let pgm_d_b = (parseInt(data[9], 16) & 0x40) >> 6
		let pgm_d_a = (parseInt(data[9], 16) & 0x80) >> 7

		//eleventh byte is the key 3 cut source (value between 1-128)
		let key3_cut = parseInt(data[10], 16)

		//twelfth byte is the LAP A contribution flag, 8 bits, 4 keys, plus 2 utils, B, and A
		let lap_a_key4 = (parseInt(data[11], 16) & 0x01) >> 0
		let lap_a_key3 = (parseInt(data[11], 16) & 0x02) >> 1
		let lap_a_key2 = (parseInt(data[11], 16) & 0x04) >> 2
		let lap_a_key1 = (parseInt(data[11], 16) & 0x08) >> 3
		let lap_a_utility2 = (parseInt(data[11], 16) & 0x10) >> 4
		let lap_a_utility1 = (parseInt(data[11], 16) & 0x20) >> 5
		let lap_a_b = (parseInt(data[11], 16) & 0x40) >> 6
		let lap_a_a = (parseInt(data[11], 16) & 0x80) >> 7

		//thirteenth byte is the key 4 fill source (value between 1-128)
		let key4_fill = parseInt(data[12], 16)

		//fourteenth byte is the LAP B contribution flag, 8 bits, 4 keys, plus 2 utils, B, and A
		let lap_b_key4 = (parseInt(data[13], 16) & 0x01) >> 0
		let lap_b_key3 = (parseInt(data[13], 16) & 0x02) >> 1
		let lap_b_key2 = (parseInt(data[13], 16) & 0x04) >> 2
		let lap_b_key1 = (parseInt(data[13], 16) & 0x08) >> 3
		let lap_b_utility2 = (parseInt(data[13], 16) & 0x10) >> 4
		let lap_b_utility1 = (parseInt(data[13], 16) & 0x20) >> 5
		let lap_b_b = (parseInt(data[13], 16) & 0x40) >> 6
		let lap_b_a = (parseInt(data[13], 16) & 0x80) >> 7

		//fifteenth byte is the key 4 cut source (value between 1-128)
		let key4_cut = parseInt(data[14], 16)

		//sixteenth byte is the LAP C contribution flag, 8 bits, 4 keys, plus 2 utils, B, and A
		let lap_c_key4 = (parseInt(data[15], 16) & 0x01) >> 0
		let lap_c_key3 = (parseInt(data[15], 16) & 0x02) >> 1
		let lap_c_key2 = (parseInt(data[15], 16) & 0x04) >> 2
		let lap_c_key1 = (parseInt(data[15], 16) & 0x08) >> 3
		let lap_c_utility2 = (parseInt(data[15], 16) & 0x10) >> 4
		let lap_c_utility1 = (parseInt(data[15], 16) & 0x20) >> 5
		let lap_c_b = (parseInt(data[15], 16) & 0x40) >> 6
		let lap_c_a = (parseInt(data[15], 16) & 0x80) >> 7

		//seventeenth byte is the A source (value between 1-128)
		let a_source = parseInt(data[16], 16)

		//eighteenth byte is the LAP D contribution flag, 8 bits, 4 keys, plus 2 utils, B, and A
		let lap_d_key4 = (parseInt(data[17], 16) & 0x01) >> 0
		let lap_d_key3 = (parseInt(data[17], 16) & 0x02) >> 1
		let lap_d_key2 = (parseInt(data[17], 16) & 0x04) >> 2
		let lap_d_key1 = (parseInt(data[17], 16) & 0x08) >> 3
		let lap_d_utility2 = (parseInt(data[17], 16) & 0x10) >> 4
		let lap_d_utility1 = (parseInt(data[17], 16) & 0x20) >> 5
		let lap_d_b = (parseInt(data[17], 16) & 0x40) >> 6
		let lap_d_a = (parseInt(data[17], 16) & 0x80) >> 7

		//nineteenth byte is the B source (value between 1-128)
		let b_source = parseInt(data[18], 16)

		//twentieth byte is the PVW A contribution flag, 8 bits, 4 keys, plus 2 utils, B, and A
		let pvw_a_key4 = (parseInt(data[19], 16) & 0x01) >> 0
		let pvw_a_key3 = (parseInt(data[19], 16) & 0x02) >> 1
		let pvw_a_key2 = (parseInt(data[19], 16) & 0x04) >> 2
		let pvw_a_key1 = (parseInt(data[19], 16) & 0x08) >> 3
		let pvw_a_utility2 = (parseInt(data[19], 16) & 0x10) >> 4
		let pvw_a_utility1 = (parseInt(data[19], 16) & 0x20) >> 5
		let pvw_a_b = (parseInt(data[19], 16) & 0x40) >> 6
		let pvw_a_a = (parseInt(data[19], 16) & 0x80) >> 7

		//twenty-first byte is the Utility 1 source (value between 1-128)
		let utility1_source = parseInt(data[20], 16)

		//twenty-second byte is the PVW 2 contribution flag, 8 bits, 4 keys, plus 2 utils, B, and A
		let pvw_2_key4 = (parseInt(data[21], 16) & 0x01) >> 0
		let pvw_2_key3 = (parseInt(data[21], 16) & 0x02) >> 1
		let pvw_2_key2 = (parseInt(data[21], 16) & 0x04) >> 2
		let pvw_2_key1 = (parseInt(data[21], 16) & 0x08) >> 3
		let pvw_2_utility2 = (parseInt(data[21], 16) & 0x10) >> 4
		let pvw_2_utility1 = (parseInt(data[21], 16) & 0x20) >> 5
		let pvw_2_b = (parseInt(data[21], 16) & 0x40) >> 6
		let pvw_2_a = (parseInt(data[21], 16) & 0x80) >> 7

		//twenty-third byte is the Utility 2 source (value between 1-128)
		let utility2_source = parseInt(data[22], 16)

		return {
			ME_ID: me_id,
			key1_fill,
			key4_cut_in_use,
			key4_fill_in_use,
			key3_cut_in_use,
			key3_fill_in_use,
			key2_cut_in_use,
			key2_fill_in_use,
			key1_cut_in_use,
			key1_fill_in_use,
			key1_cut,
			pgm_a_key4,
			pgm_a_key3,
			pgm_a_key2,
			pgm_a_key1,
			pgm_a_utility2,
			pgm_a_utility1,
			pgm_a_b,
			pgm_a_a,
			key2_fill,
			pgm_b_key4,
			pgm_b_key3,
			pgm_b_key2,
			pgm_b_key1,
			pgm_b_utility2,
			pgm_b_utility1,
			pgm_b_b,
			pgm_b_a,
			key2_cut,
			pgm_c_key4,
			pgm_c_key3,
			pgm_c_key2,
			pgm_c_key1,
			pgm_c_utility2,
			pgm_c_utility1,
			pgm_c_b,
			pgm_c_a,
			key3_fill,
			pgm_d_key4,
			pgm_d_key3,
			pgm_d_key2,
			pgm_d_key1,
			pgm_d_utility2,
			pgm_d_utility1,
			pgm_d_b,
			pgm_d_a,
			key3_cut,
			lap_a_key4,
			lap_a_key3,
			lap_a_key2,
			lap_a_key1,
			lap_a_utility2,
			lap_a_utility1,
			lap_a_b,
			lap_a_a,
			key4_fill,
			lap_b_key4,
			lap_b_key3,
			lap_b_key2,
			lap_b_key1,
			lap_b_utility2,
			lap_b_utility1,
			lap_b_b,
			lap_b_a,
			key4_cut,
			lap_c_key4,
			lap_c_key3,
			lap_c_key2,
			lap_c_key1,
			lap_c_utility2,
			lap_c_utility1,
			lap_c_b,
			lap_c_a,
			a_source,
			lap_d_key4,
			lap_d_key3,
			lap_d_key2,
			lap_d_key1,
			lap_d_utility2,
			lap_d_utility1,
			lap_d_b,
			lap_d_a,
			b_source,
			pvw_a_key4,
			pvw_a_key3,
			pvw_a_key2,
			pvw_a_key1,
			pvw_a_utility2,
			pvw_a_utility1,
			pvw_a_b,
			pvw_a_a,
			utility1_source,
			pvw_2_key4,
			pvw_2_key3,
			pvw_2_key2,
			pvw_2_key1,
			pvw_2_utility2,
			pvw_2_utility1,
			pvw_2_b,
			pvw_2_a,
			utility2_source,
		}
	}

	private parseExternalProcContribution(data) {}

	private parseStillStoreContribution(data) {
		// Ensure the data has at least 3 bytes as per the table
		if (data.length < 3) {
			throw new Error('Insufficient data for Still Store Contribution')
		}

		const input1Source = parseInt(data[0], 16)
		const input2Source = parseInt(data[1], 16)
		const modeByte = parseInt(data[2], 16)

		const output78Mode = (modeByte & 0x80) >> 7
		const output56Mode = (modeByte & 0x40) >> 6
		const output34Mode = (modeByte & 0x20) >> 5
		const output12Mode = (modeByte & 0x10) >> 4
		const inputMode = (modeByte & 0x08) >> 3
		const input2Rec = (modeByte & 0x04) >> 2
		const input1Rec = (modeByte & 0x02) >> 1

		return {
			input1Source,
			input2Source,
			output78Mode,
			output56Mode,
			output34Mode,
			output12Mode,
			inputMode,
			input2Rec,
			input1Rec,
		}
	}

	private parseOutputsStatus(data, blockID: number) {
		//the block id determines the block of outputs this data is for
		//for example, block id1, the 8 outputs are 1-8, block id2, the 8 outputs are 9-16, etc

		//byte 1 is the first output status
		let byte1 = parseInt(data[0], 16)

		//byte 2 is 8 bits of output status mode, the first four are 0,
		//the second four are out 7/8, 5/6, 3/4, 1/2 where 0 = "video-video" and 1 = "video-key"
		let byte2 = parseInt(data[1], 16)
		let output78_mode = (byte2 & 0x01) >> 0
		let output56_mode = (byte2 & 0x02) >> 1
		let output34_mode = (byte2 & 0x04) >> 2
		let output12_mode = (byte2 & 0x08) >> 3

		//byte 3 is the second output status
		let byte3 = parseInt(data[2], 16)

		//byte 4 is 8 bits of output on air status
		let byte4 = parseInt(data[3], 16)
		let output8_on_air = (byte4 & 0x01) >> 0
		let output7_on_air = (byte4 & 0x02) >> 1
		let output6_on_air = (byte4 & 0x04) >> 2
		let output5_on_air = (byte4 & 0x08) >> 3
		let output4_on_air = (byte4 & 0x10) >> 4
		let output3_on_air = (byte4 & 0x20) >> 5
		let output2_on_air = (byte4 & 0x40) >> 6
		let output1_on_air = (byte4 & 0x80) >> 7

		//byte 5 is the third output status
		let byte5 = parseInt(data[4], 16)

		//byte 6 is the fourth output status
		let byte6 = parseInt(data[5], 16)

		//byte 7 is the fifth output status
		let byte7 = parseInt(data[6], 16)

		//byte 8 is the sixth output status
		let byte8 = parseInt(data[7], 16)

		//byte 9 is the seventh output status
		let byte9 = parseInt(data[8], 16)

		//byte 10 is the eighth output status
		let byte10 = parseInt(data[9], 16)

		let outputsBytes = {
			1: byte1,
			2: byte3,
			3: byte5,
			4: byte6,
			5: byte7,
			6: byte8,
			7: byte9,
			8: byte10,
		}

		let outputs = []

		//when returning the object, name the output based on the block id
		let outputOffsetNumber = (blockID - 1) * 8

		for (let i = 1; i <= 8; i++) {
			let outputObj = {
				blockId: blockID,
				bus: 'output' + (outputOffsetNumber + i),
				address: outputsBytes[i].toString(),
			}
			outputs.push(outputObj)
		}
		return outputs
	}

	private parseSourceName(data, namesetId: number) {
		const nameType = namesetId === 1 ? 'name' : namesetId === 2 ? 'alias' : 'unknown'

		const nameCharacters = []
		const nicknameCharacters = []
		let sourceId = null

		// Iterate over each byte in the data
		for (let i = 0; i < data.length; i++) {
			const byteValue = parseInt(data[i], 16)

			// First byte should contain the Source ID and Nameset ID
			if (i === 0) {
				sourceId = byteValue // The full byte represents the Source ID (1-128)
			} else if (i >= 1 && i <= 12) {
				// Name characters (1-12)
				nameCharacters.push(String.fromCharCode(byteValue))
			} else if (i >= 13 && i <= 18) {
				// Nickname characters (1-6)
				nicknameCharacters.push(String.fromCharCode(byteValue))
			}
		}

		const name = nameCharacters.join('').replace(/\0/g, '')
		const nickname = nicknameCharacters.join('').replace(/\0/g, '')

		return {
			sourceId,
			namesetId,
			nameType,
			name,
			nickname,
		}
	}

	private parseUpdate(data) {}

	//TALLY SPECIFIC FUNCTIONS
	private processTally(tallyDataType: string, data) {
		if (tallyDataType === 'me') {
			/*
				loop through device_sources
				if device_source.sourceId === this.source.id
					and if device_source.bus == 'me' + data.ME_ID
						if the device_source.address matches data.a_source, it is in pgm on that particular ME
							add it to this.CTPtallydata
								address: data.a_source.toString()
								bus: 'me' + data.ME_ID
								busType: 'program'
						if it does not match, remove it from this.CTPtallydata (where address === data.a_source and bus === 'me' + data.ME_ID)
						if the device_source.address matches data.b_source, it is in pvw on that particular ME
							add it to this.CTPtallydata
								address: data.b_source.toString()
								bus: 'me' + data.ME_ID
								busType: 'preview'
							if it does not match, remove it from this.CTPtallydata (where address === data.b_source and bus === 'me' + data.ME_ID)
					finally loop through this.CTPtallydata
						if there is a busType of 'program' for this device_source.address, add 'program' to the busses array
						if there is a busType of 'preview' for this device_source.address, add 'preview' to the busses array
			*/

			let addressPGM = data.a_source.toString()
			let addressPVW = data.b_source.toString()

			let bus = 'me' + data.ME_ID

			let busIdPGM = '334e4eda' //this is the busId for the program bus as defined in default config
			let busIdPVW = 'e393251c' //this is the busId for the preview bus as defined in default config

			for (let i = 0; i < device_sources.length; i++) {
				let deviceSourceObj = device_sources[i]
				if (deviceSourceObj.sourceId === this.source.id) {
					//this device_source is associated with the tally data of this source
					if (deviceSourceObj.bus === bus) {
						//the me of this contribution data
						if (deviceSourceObj.address === addressPGM) {
							//this device_source's address matches what was in the a_source field
							this.addTally(deviceSourceObj.address, busIdPGM)
						} else {
							this.removeTally(deviceSourceObj.address, busIdPGM)
						}
						if (device_sources[i].address === addressPVW) {
							this.addTally(deviceSourceObj.address, busIdPVW)
						} else {
							this.removeTally(deviceSourceObj.address, busIdPVW)
						}
					}
				}
			}

			this.checkBusssesForAddress(addressPGM)
			this.checkBusssesForAddress(addressPVW)
		} else if (tallyDataType === 'output') {
			//we will process this similar to ME data but only as a program bus. maybe later we can add proper aux support
			//loop through the data array, it will be 8 entries, one for each output
			for (let i = 0; i < data.length; i++) {
				let bus = data[i].bus
				let address = data[i].address.toString()

				let busId = ''

				//find the busId for this bus by searching for the bus in the busArray
				for (let j = 0; j < this.CTPbusArray.length; j++) {
					if (this.CTPbusArray[j].bus === bus) {
						busId = this.CTPbusArray[j].busId
						break
					}
				}

				for (let i = 0; i < device_sources.length; i++) {
					let deviceSourceObj = device_sources[i]
					if (deviceSourceObj.sourceId === this.source.id) {
						//this device_source is associated with the tally data of this output source
						if (deviceSourceObj.bus === bus) {
							//the output number of this contribution data
							if (deviceSourceObj.address === address) {
								//this device_source's address matches what was in the output/aux pgm field
								this.addTally(deviceSourceObj.address, busId) //currently in this output
							} else {
								this.removeTally(deviceSourceObj.address, busId) //no longer in this output
							}
						}
					}
				}

				this.checkBusssesForAddress(address)
			}
		}
	}

	private addTally(address: string, busId: string) {
		let found = false

		for (let i = 0; i < this.CTPtallydata.length; i++) {
			if (this.CTPtallydata[i].address === address && this.CTPtallydata[i].busId === busId) {
				found = true
				break
			}
		}

		//get the busType based on the busId
		let busType = currentConfig.bus_options.find((obj) => obj.id === busId).type

		if (!found) {
			//if there was not an entry in the array for this address and bus and busId
			let tallyObj = {
				address: address,
				busId: busId,
				busType: busType,
			}
			this.CTPtallydata.push(tallyObj)
		}
	}

	private removeTally(address: string, busId: string) {
		for (let i = 0; i < this.CTPtallydata.length; i++) {
			if (this.CTPtallydata[i].address === address && this.CTPtallydata[i].busId === busId) {
				this.CTPtallydata.splice(i, 1)
				break
			}
		}
	}

	private checkBusssesForAddress(address: string) {
		//get array of unique device_source addresses for this source
		let uniqueAddresses = [
			...new Set(device_sources.filter((obj) => obj.sourceId === this.source.id).map((obj) => obj.address)),
		]

		if (uniqueAddresses.length > 0) {
			for (let i = 0; i < uniqueAddresses.length; i++) {
				let address = uniqueAddresses[i]
				let busses = []

				for (let j = 0; j < this.CTPtallydata.length; j++) {
					if (this.CTPtallydata[j].address === address) {
						busses.push(this.CTPtallydata[j].busId)
					}
				}

				//make sure the busses array is unique
				busses = [...new Set(busses)]

				this.setBussesForAddress(address, busses)
			}
		}
	}

	public exit(): void {
		super.exit()
		this.server.close()
		FreePort(this.source.data.port, this.source.id)
		this.connected.next(false)
	}
}
