import { device_sources, logger } from "..";
import { RegisterTallyInput } from "../_decorators/RegisterTallyInput.decorator";
import { FreePort, UsePort } from "../_decorators/UsesPort.decorator";
import { Source } from '../_models/Source';
import { TallyInputConfigField } from "../_types/TallyInputConfigField";
import { TallyInput } from './_Source';
import net from "net";
import dgram from "dgram";

const CTPbusses = [
	{ address: '1', bus: 'me1', name: "ME 1", type: "me" },
	{ address: '2', bus: 'me2', name: "ME 2", type: "me" },
	{ address: '3', bus: 'me3', name: "ME 3", type: "me" },
	{ address: '4', bus: 'me4', name: "ME 4", type: "me" },
	{ address: '1', bus: 'output1', name: "Output 1", type: "output" },
	{ address: '2', bus: 'output2', name: "Output 2", type: "output" },
	{ address: '3', bus: 'output3', name: "Output 3", type: "output" },
	{ address: '4', bus: 'output4', name: "Output 4", type: "output" },
	{ address: '5', bus: 'output5', name: "Output 5", type: "output" },
	{ address: '6', bus: 'output6', name: "Output 6", type: "output" },
	{ address: '7', bus: 'output7', name: "Output 7", type: "output" },
	{ address: '8', bus: 'output8', name: "Output 8", type: "output" },
	{ address: '9', bus: 'output9', name: "Output 9", type: "output" },
	{ address: '10', bus: 'output10', name: "Output 10", type: "output" },
	{ address: '11', bus: 'output11', name: "Output 11", type: "output" },
	{ address: '12', bus: 'output12', name: "Output 12", type: "output" },
	{ address: '13', bus: 'output13', name: "Output 13", type: "output" },
	{ address: '14', bus: 'output14', name: "Output 14", type: "output" },
	{ address: '15', bus: 'output15', name: "Output 15", type: "output" },
	{ address: '16', bus: 'output16', name: "Output 16", type: "output" },
	{ address: '17', bus: 'output17', name: "Output 17", type: "output" },
	{ address: '18', bus: 'output18', name: "Output 18", type: "output" },
	{ address: '19', bus: 'output19', name: "Output 19", type: "output" },
	{ address: '20', bus: 'output20', name: "Output 20", type: "output" },
	{ address: '21', bus: 'output21', name: "Output 21", type: "output" },
	{ address: '22', bus: 'output22', name: "Output 22", type: "output" },
	{ address: '23', bus: 'output23', name: "Output 23", type: "output" },
	{ address: '24', bus: 'output24', name: "Output 24", type: "output" },
	{ address: '25', bus: 'output25', name: "Output 25", type: "output" },
	{ address: '26', bus: 'output26', name: "Output 26", type: "output" },
	{ address: '27', bus: 'output27', name: "Output 27", type: "output" },
	{ address: '28', bus: 'output28', name: "Output 28", type: "output" },
	{ address: '29', bus: 'output29', name: "Output 29", type: "output" },
	{ address: '30', bus: 'output30', name: "Output 30", type: "output" },
	{ address: '31', bus: 'output31', name: "Output 31", type: "output" },
	{ address: '32', bus: 'output32', name: "Output 32", type: "output" },
	{ address: '33', bus: 'output33', name: "Output 33", type: "output" },
	{ address: '34', bus: 'output34', name: "Output 34", type: "output" },
	{ address: '35', bus: 'output35', name: "Output 35", type: "output" },
	{ address: '36', bus: 'output36', name: "Output 36", type: "output" },
	{ address: '37', bus: 'output37', name: "Output 37", type: "output" },
	{ address: '38', bus: 'output38', name: "Output 38", type: "output" },
	{ address: '39', bus: 'output39', name: "Output 39", type: "output" },
	{ address: '40', bus: 'output40', name: "Output 40", type: "output" },
	{ address: '41', bus: 'output41', name: "Output 41", type: "output" },
	{ address: '42', bus: 'output42', name: "Output 42", type: "output" },
	{ address: '43', bus: 'output43', name: "Output 43", type: "output" },
	{ address: '44', bus: 'output44', name: "Output 44", type: "output" },
	{ address: '45', bus: 'output45', name: "Output 45", type: "output" },
	{ address: '46', bus: 'output46', name: "Output 46", type: "output" },
	{ address: '47', bus: 'output47', name: "Output 47", type: "output" },
	{ address: '48', bus: 'output48', name: "Output 48", type: "output" },
];

const CTPbussesRossVision = [
	{ address: '1', bus: 'me1', name: "ME 1", type: "me" },
	{ address: '2', bus: 'me2', name: "ME 2", type: "me" },
	{ address: '3', bus: 'me3', name: "ME 3", type: "me" },
	{ address: '4', bus: 'me4', name: "ME 4", type: "me" },
	{ address: '1', bus: 'aux1:1', name: "Aux 1:1", type: "output" },
	{ address: '2', bus: 'aux1:2', name: "Aux 1:2", type: "output" },
	{ address: '3', bus: 'aux1:3', name: "Aux 1:3", type: "output" },
	{ address: '4', bus: 'aux1:4', name: "Aux 1:4", type: "output" },
	{ address: '5', bus: 'pgm', name: "PGM", type: "output" },
	{ address: '6', bus: 'pvw', name: "PVW", type: "output" },
	{ address: '7', bus: 'clean', name: "Clean", type: "output" },
	{ address: '8', bus: 'aux1:5', name: "Aux 1:5", type: "output" },
	{ address: '9', bus: 'aux1:6', name: "Aux 1:6", type: "output" },
	{ address: '10', bus: 'aux1:7', name: "Aux 1:7", type: "output" },
	{ address: '11', bus: 'aux1:8', name: "Aux 1:8", type: "output" },
	{ address: '12', bus: 'aux2:1', name: "Aux 2:1", type: "output" },
	{ address: '13', bus: 'aux2:2', name: "Aux 2:2", type: "output" },
	{ address: '14', bus: 'aux2:3', name: "Aux 2:3", type: "output" },
	{ address: '15', bus: 'aux2:4', name: "Aux 2:4", type: "output" },
	{ address: '16', bus: 'aux2:5', name: "Aux 2:5", type: "output" },
	{ address: '17', bus: 'aux2:6', name: "Aux 2:6", type: "output" },
	{ address: '18', bus: 'aux2:7', name: "Aux 2:7", type: "output" },
	{ address: '19', bus: 'aux2:8', name: "Aux 2:8", type: "output" },
	{ address: '20', bus: 'aux3:1', name: "Aux 3:1", type: "output" },
	{ address: '21', bus: 'aux3:2', name: "Aux 3:2", type: "output" },
	{ address: '22', bus: 'aux3:3', name: "Aux 3:3", type: "output" },
	{ address: '23', bus: 'aux3:4', name: "Aux 3:4", type: "output" },
	{ address: '24', bus: 'aux3:5', name: "Aux 3:5", type: "output" },
	{ address: '25', bus: 'aux3:6', name: "Aux 3:6", type: "output" },
	{ address: '26', bus: 'aux3:7', name: "Aux 3:7", type: "output" },
	{ address: '27', bus: 'aux3:8', name: "Aux 3:8", type: "output" },
	{ address: '28', bus: 'aux4:1', name: "Aux 4:1", type: "output" },
	{ address: '29', bus: 'aux4:2', name: "Aux 4:2", type: "output" },
	{ address: '30', bus: 'aux4:3', name: "Aux 4:3", type: "output" },
	{ address: '31', bus: 'aux4:4', name: "Aux 4:4", type: "output" },
	{ address: '32', bus: 'aux4:5', name: "Aux 4:5", type: "output" },
	{ address: '33', bus: 'aux4:6', name: "Aux 4:6", type: "output" },
	{ address: '34', bus: 'aux4:7', name: "Aux 4:7", type: "output" },
	{ address: '35', bus: 'aux4:8', name: "Aux 4:8", type: "output" },
	{ address: '36', bus: 'aux5:1', name: "Aux 5:1", type: "output" },
	{ address: '37', bus: 'aux5:2', name: "Aux 5:2", type: "output" },
	{ address: '38', bus: 'aux5:3', name: "Aux 5:3", type: "output" },
	{ address: '39', bus: 'aux5:4', name: "Aux 5:4", type: "output" },
	{ address: '40', bus: 'aux5:5', name: "Aux 5:5", type: "output" },
	{ address: '41', bus: 'aux5:6', name: "Aux 5:6", type: "output" },
	{ address: '42', bus: 'aux5:7', name: "Aux 5:7", type: "output" },
	{ address: '43', bus: 'aux5:8', name: "Aux 5:8", type: "output" },
	{ address: '44', bus: 'aux6:1', name: "Aux 6:1", type: "output" },
	{ address: '45', bus: 'aux6:2', name: "Aux 6:2", type: "output" },
	{ address: '46', bus: 'aux6:3', name: "Aux 6:3", type: "output" },
	{ address: '47', bus: 'aux6:4', name: "Aux 6:4", type: "output" },
	{ address: '48', bus: 'aux6:5', name: "Aux 6:5", type: "output" },
];

const CTPFields: TallyInputConfigField[] = [
	{
        fieldName: 'transport_type', fieldLabel: 'Transport Type', fieldType: 'dropdown',
        options: [
            { id: 'udp', label: 'UDP' },
            { id: 'tcp', label: 'TCP' }
        ]
    },
	{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
];

@RegisterTallyInput("b4f626a6", "GV Contribution Tally", "", CTPFields, CTPbusses)
@RegisterTallyInput("9501c3fc", "Ross Vision (Contribution Tally)", "", CTPFields, CTPbussesRossVision)
export class CTPSource extends TallyInput {
	private CTPtallydata = [];
    private server: any;
    constructor(source: Source) {
        super(source);

        let port = source.data.port;

        UsePort(port, this.source.id);

		if (source.data.transport_type === 'udp') {
			this.server = dgram.createSocket({ type: 'udp4', reuseAddr: true });

			this.server.on('message', (data) => {
				this.connected.next(true);
				this.processCTPData(data);
			});

			this.server.on('listening', function(){
				var address = this.server.address();
				console.log("listening on :" + address.address + ":" + address.port);
			});
			
			this.server.bind(port);
		}
		else {
			this.server = net.createServer((socket) => {
				socket.on('data', (data) => {
					this.connected.next(true);
					this.processCTPData(data);
				});

				socket.on('close', () => {
					this.connected.next(false);
				});
			}).listen(port, () => {
				this.connected.next(true);
			});
		}
    }

	private processCTPData(data: Buffer) {
		const sections = this.parseHexData(data.toString('hex'));

		//parseHexData will call the various other functions (parseMEContribution, parseExternalProcContribution, etc) and return an array of objects based on the command code
	
		sections.forEach((section, index) => {
			switch (section.commandCode) {
				case 0x8: // ME Contribution
					this.processTally('me', section.data);
					break;
				case 0x9: // External Proc Contribution
					//console.log("External Proc Contribution", section);
					break;
				case 0xA: // Still Store Contribution
					//console.log("Still Store Contribution", section);
					break;
				case 0xB: // Outputs Status
					this.processTally('output', section.data);
					break;
				case 0xC: // Source Name
					this.renameAddress(section.data.sourceId.toString(), section.data.sourceId.toString(), section.data.sourceId.toString() + ": " + section.data.name);
					//console.log(section.data);
					break;
				case 0xD: // Update
					//console.log("Update", section);
					break;
				default:
					//console.log("Unknown Command", section);
					break;
			}
		});

		this.sendTallyData(); // send the tally data now that it has all been processed (prevents multiple sends)
	}

	private parseHexData(hexData: string) {
		const commandCodeNames = {
			0x8: "ME Contribution",
			0x9: "External Proc Contribution",
			0xA: "Still Store Contribution",
			0xB: "Outputs Status",
			0xC: "Source Name",
			0xD: "Update",
			0xE: "Unused",
			0xF: "Unused"
		};
	
		const sections = [];
		const hexArray = hexData.match(/.{1,2}/g); // Split the string into pairs of two characters
		let currentSection = [];
		let commandCode = null;
		let instanceID = null;
	
		hexArray.forEach((byte, index) => {
			const byteValue = parseInt(byte, 16);
			const firstNibble = (byteValue & 0xF0) >> 4; // Command code (first half)
			const secondNibble = byteValue & 0x0F; // Instance ID (second half)
	
			// If the byte is large, it could be a command code (and likely repeated)
			if (byteValue > 128 && index < hexArray.length - 1 && byte === hexArray[index + 1]) {
				// Save the current section if there is one
				if (currentSection.length > 0) {
					sections.push({ commandCode, instanceID, data: currentSection });
				}
				// Start a new section with this byte as the command code
				commandCode = firstNibble;
				instanceID = secondNibble;
				currentSection = [];
				hexArray[index + 1] = null; // Skip the next byte since it's the same
			} else if (byte !== null) {
				currentSection.push(byte);
			}
		});
	
		// Push the last section if it exists
		if (currentSection.length > 0) {
			sections.push({ commandCode, instanceID, data: currentSection });
		}
	
		return sections.map(section => {
			const commandName = commandCodeNames[section.commandCode] || "Unknown Command";
	
			let parsedData;
			switch (section.commandCode) {
				case 0x8: // ME Contribution
					parsedData = this.parseMEContribution(section.data, section.instanceID);
					break;
				case 0x9: // External Proc Contribution
					parsedData = this.parseExternalProcContribution(section.data);
					break;
				case 0xA: // Still Store Contribution
					parsedData = this.parseStillStoreContribution(section.data);
					break;
				case 0xB: // Outputs Status
					parsedData = this.parseOutputsStatus(section.data);
					break;
				case 0xC: // Source Name
					parsedData = this.parseSourceName(section.data, section.instanceID);
					break;
				case 0xD: // Update
					parsedData = this.parseUpdate(section.data);
					break;
				default:
					parsedData = { rawData: section.data };
					break;
			}
	
			return {
				commandCode: section.commandCode,
				commandName,
				instanceID: section.instanceID,
				data: parsedData
			};
		});
	}

	private parseMEContribution(data, me_id: number) {
		//23 bytes total
	
		//first byte is the key 1 fill source (value between 1-128)
		let key1_fill = parseInt(data[0], 16);
	
		//second byte is the keyer buses in use, 8 bits, one bit for each keyer 1-4 cut/fill
		let key4_cut_in_use = (parseInt(data[1], 16) & 0x01) >> 0;
		let key4_fill_in_use = (parseInt(data[1], 16) & 0x02) >> 1;
		let key3_cut_in_use = (parseInt(data[1], 16) & 0x04) >> 2;
		let key3_fill_in_use = (parseInt(data[1], 16) & 0x08) >> 3;
		let key2_cut_in_use = (parseInt(data[1], 16) & 0x10) >> 4;
		let key2_fill_in_use = (parseInt(data[1], 16) & 0x20) >> 5;
		let key1_cut_in_use = (parseInt(data[1], 16) & 0x40) >> 6;
		let key1_fill_in_use = (parseInt(data[1], 16) & 0x80) >> 7;
	
		//third byte is the key 1 cut source (value between 1-128)
		let key1_cut = parseInt(data[2], 16);
	
		//fourth byte is PGM A contribution flag, 8 bits, 4 keys, plus 2 utils, B, and A
		let pgm_a_key4 = (parseInt(data[3], 16) & 0x01) >> 0;
		let pgm_a_key3 = (parseInt(data[3], 16) & 0x02) >> 1;
		let pgm_a_key2 = (parseInt(data[3], 16) & 0x04) >> 2;
		let pgm_a_key1 = (parseInt(data[3], 16) & 0x08) >> 3;
		let pgm_a_utility2 = (parseInt(data[3], 16) & 0x10) >> 4;
		let pgm_a_utility1 = (parseInt(data[3], 16) & 0x20) >> 5;
		let pgm_a_b = (parseInt(data[3], 16) & 0x40) >> 6;
		let pgm_a_a = (parseInt(data[3], 16) & 0x80) >> 7;
	
		//fifth byte is the key 2 fill source (value between 1-128)
		let key2_fill = parseInt(data[4], 16);
	
		//sixth byte is the PGM B contribution flag, 8 bits, 4 keys, plus 2 utils, B, and A
		let pgm_b_key4 = (parseInt(data[5], 16) & 0x01) >> 0;
		let pgm_b_key3 = (parseInt(data[5], 16) & 0x02) >> 1;
		let pgm_b_key2 = (parseInt(data[5], 16) & 0x04) >> 2;
		let pgm_b_key1 = (parseInt(data[5], 16) & 0x08) >> 3;
		let pgm_b_utility2 = (parseInt(data[5], 16) & 0x10) >> 4;
		let pgm_b_utility1 = (parseInt(data[5], 16) & 0x20) >> 5;
		let pgm_b_b = (parseInt(data[5], 16) & 0x40) >> 6;
		let pgm_b_a = (parseInt(data[5], 16) & 0x80) >> 7;
	
		//seventh byte is the key 2 cut source (value between 1-128)
		let key2_cut = parseInt(data[6], 16);
	
		//eighth byte is the PGM C contribution flag, 8 bits, 4 keys, plus 2 utils, B, and A
		let pgm_c_key4 = (parseInt(data[7], 16) & 0x01) >> 0;
		let pgm_c_key3 = (parseInt(data[7], 16) & 0x02) >> 1;
		let pgm_c_key2 = (parseInt(data[7], 16) & 0x04) >> 2;
		let pgm_c_key1 = (parseInt(data[7], 16) & 0x08) >> 3;
		let pgm_c_utility2 = (parseInt(data[7], 16) & 0x10) >> 4;
		let pgm_c_utility1 = (parseInt(data[7], 16) & 0x20) >> 5;
		let pgm_c_b = (parseInt(data[7], 16) & 0x40) >> 6;
		let pgm_c_a = (parseInt(data[7], 16) & 0x80) >> 7;
	
		//ninth byte is the key 3 fill source (value between 1-128)
		let key3_fill = parseInt(data[8], 16);
	
		//tenth byte is the PGM D contribution flag, 8 bits, 4 keys, plus 2 utils, B, and A
		let pgm_d_key4 = (parseInt(data[9], 16) & 0x01) >> 0;
		let pgm_d_key3 = (parseInt(data[9], 16) & 0x02) >> 1;
		let pgm_d_key2 = (parseInt(data[9], 16) & 0x04) >> 2;
		let pgm_d_key1 = (parseInt(data[9], 16) & 0x08) >> 3;
		let pgm_d_utility2 = (parseInt(data[9], 16) & 0x10) >> 4;
		let pgm_d_utility1 = (parseInt(data[9], 16) & 0x20) >> 5;
		let pgm_d_b = (parseInt(data[9], 16) & 0x40) >> 6;
		let pgm_d_a = (parseInt(data[9], 16) & 0x80) >> 7;
	
		//eleventh byte is the key 3 cut source (value between 1-128)
		let key3_cut = parseInt(data[10], 16);
	
		//twelfth byte is the LAP A contribution flag, 8 bits, 4 keys, plus 2 utils, B, and A
		let lap_a_key4 = (parseInt(data[11], 16) & 0x01) >> 0;
		let lap_a_key3 = (parseInt(data[11], 16) & 0x02) >> 1;
		let lap_a_key2 = (parseInt(data[11], 16) & 0x04) >> 2;
		let lap_a_key1 = (parseInt(data[11], 16) & 0x08) >> 3;
		let lap_a_utility2 = (parseInt(data[11], 16) & 0x10) >> 4;
		let lap_a_utility1 = (parseInt(data[11], 16) & 0x20) >> 5;
		let lap_a_b = (parseInt(data[11], 16) & 0x40) >> 6;
		let lap_a_a = (parseInt(data[11], 16) & 0x80) >> 7;
	
		//thirteenth byte is the key 4 fill source (value between 1-128)
		let key4_fill = parseInt(data[12], 16);
	
		//fourteenth byte is the LAP B contribution flag, 8 bits, 4 keys, plus 2 utils, B, and A
		let lap_b_key4 = (parseInt(data[13], 16) & 0x01) >> 0;
		let lap_b_key3 = (parseInt(data[13], 16) & 0x02) >> 1;
		let lap_b_key2 = (parseInt(data[13], 16) & 0x04) >> 2;
		let lap_b_key1 = (parseInt(data[13], 16) & 0x08) >> 3;
		let lap_b_utility2 = (parseInt(data[13], 16) & 0x10) >> 4;
		let lap_b_utility1 = (parseInt(data[13], 16) & 0x20) >> 5;
		let lap_b_b = (parseInt(data[13], 16) & 0x40) >> 6;
		let lap_b_a = (parseInt(data[13], 16) & 0x80) >> 7;
	
		//fifteenth byte is the key 4 cut source (value between 1-128)
		let key4_cut = parseInt(data[14], 16);
	
		//sixteenth byte is the LAP C contribution flag, 8 bits, 4 keys, plus 2 utils, B, and A
		let lap_c_key4 = (parseInt(data[15], 16) & 0x01) >> 0;
		let lap_c_key3 = (parseInt(data[15], 16) & 0x02) >> 1;
		let lap_c_key2 = (parseInt(data[15], 16) & 0x04) >> 2;
		let lap_c_key1 = (parseInt(data[15], 16) & 0x08) >> 3;
		let lap_c_utility2 = (parseInt(data[15], 16) & 0x10) >> 4;
		let lap_c_utility1 = (parseInt(data[15], 16) & 0x20) >> 5;
		let lap_c_b = (parseInt(data[15], 16) & 0x40) >> 6;
		let lap_c_a = (parseInt(data[15], 16) & 0x80) >> 7;
	
		//seventeenth byte is the A source (value between 1-128)
		let a_source = parseInt(data[16], 16);
	
		//eighteenth byte is the LAP D contribution flag, 8 bits, 4 keys, plus 2 utils, B, and A
		let lap_d_key4 = (parseInt(data[17], 16) & 0x01) >> 0;
		let lap_d_key3 = (parseInt(data[17], 16) & 0x02) >> 1;
		let lap_d_key2 = (parseInt(data[17], 16) & 0x04) >> 2;
		let lap_d_key1 = (parseInt(data[17], 16) & 0x08) >> 3;
		let lap_d_utility2 = (parseInt(data[17], 16) & 0x10) >> 4;
		let lap_d_utility1 = (parseInt(data[17], 16) & 0x20) >> 5;
		let lap_d_b = (parseInt(data[17], 16) & 0x40) >> 6;
		let lap_d_a = (parseInt(data[17], 16) & 0x80) >> 7;
	
		//nineteenth byte is the B source (value between 1-128)
		let b_source = parseInt(data[18], 16);
	
		//twentieth byte is the PVW A contribution flag, 8 bits, 4 keys, plus 2 utils, B, and A
		let pvw_a_key4 = (parseInt(data[19], 16) & 0x01) >> 0;
		let pvw_a_key3 = (parseInt(data[19], 16) & 0x02) >> 1;
		let pvw_a_key2 = (parseInt(data[19], 16) & 0x04) >> 2;
		let pvw_a_key1 = (parseInt(data[19], 16) & 0x08) >> 3;
		let pvw_a_utility2 = (parseInt(data[19], 16) & 0x10) >> 4;
		let pvw_a_utility1 = (parseInt(data[19], 16) & 0x20) >> 5;
		let pvw_a_b = (parseInt(data[19], 16) & 0x40) >> 6;
		let pvw_a_a = (parseInt(data[19], 16) & 0x80) >> 7;
	
		//twenty-first byte is the Utility 1 source (value between 1-128)
		let utility1_source = parseInt(data[20], 16);
	
		//twenty-second byte is the PVW 2 contribution flag, 8 bits, 4 keys, plus 2 utils, B, and A
		let pvw_2_key4 = (parseInt(data[21], 16) & 0x01) >> 0;
		let pvw_2_key3 = (parseInt(data[21], 16) & 0x02) >> 1;
		let pvw_2_key2 = (parseInt(data[21], 16) & 0x04) >> 2;
		let pvw_2_key1 = (parseInt(data[21], 16) & 0x08) >> 3;
		let pvw_2_utility2 = (parseInt(data[21], 16) & 0x10) >> 4;
		let pvw_2_utility1 = (parseInt(data[21], 16) & 0x20) >> 5;
		let pvw_2_b = (parseInt(data[21], 16) & 0x40) >> 6;
		let pvw_2_a = (parseInt(data[21], 16) & 0x80) >> 7;
	
		//twenty-third byte is the Utility 2 source (value between 1-128)
		let utility2_source = parseInt(data[22], 16);
	
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
			utility2_source
		};
	}
	
	private parseExternalProcContribution(data) {
	
	}
	
	private parseStillStoreContribution(data) {
		// Ensure the data has at least 3 bytes as per the table
		if (data.length < 3) {
			throw new Error("Insufficient data for Still Store Contribution");
		}
	
		const input1Source = parseInt(data[0], 16);
		const input2Source = parseInt(data[1], 16);
		const modeByte = parseInt(data[2], 16);
	
		const output78Mode = (modeByte & 0x80) >> 7;
		const output56Mode = (modeByte & 0x40) >> 6;
		const output34Mode = (modeByte & 0x20) >> 5;
		const output12Mode = (modeByte & 0x10) >> 4;
		const inputMode = (modeByte & 0x08) >> 3;
		const input2Rec = (modeByte & 0x04) >> 2;
		const input1Rec = (modeByte & 0x02) >> 1;
	
		return {
			input1Source,
			input2Source,
			output78Mode,
			output56Mode,
			output34Mode,
			output12Mode,
			inputMode,
			input2Rec,
			input1Rec
		};
	}
	
	private parseOutputsStatus(data) {
		let blockID = null;
		const outputs = [];
	
		// Iterate over each byte in the data
		for (let i = 0; i < data.length; i++) {
			const byteValue = parseInt(data[i], 16);
	
			if (i === 0) {
				// First byte is the Block ID
				blockID = byteValue;
			} else {
				// Subsequent bytes are the Output Source and Mode
				const sourceID = (byteValue & 0x7F); // Source ID (7 bits)
				const mode = (byteValue & 0x80) >> 7; // Mode (1 bit, MSB)
	
				outputs.push({
					outputIndex: i,
					sourceID,
					mode: mode === 0 ? "Video-video" : "Video-key"
				});
			}
		}
	
		return {
			blockID,
			outputs
		};
	}
	
	private parseSourceName(data, namesetId: number) {
		const nameType = namesetId === 1 ? "name" : namesetId === 2 ? "alias" : "unknown";
	
		const nameCharacters = [];
		const nicknameCharacters = [];
		let sourceId = null;
	
		// Iterate over each byte in the data
		for (let i = 0; i < data.length; i++) {
			const byteValue = parseInt(data[i], 16);
			
			// First byte should contain the Source ID and Nameset ID
			if (i === 0) {
				sourceId = byteValue;  // The full byte represents the Source ID (1-128)
			} else if (i >= 1 && i <= 12) {
				// Name characters (1-12)
				nameCharacters.push(String.fromCharCode(byteValue));
			} else if (i >= 13 && i <= 18) {
				// Nickname characters (1-6)
				nicknameCharacters.push(String.fromCharCode(byteValue));
			}
		}
	
		const name = nameCharacters.join('').replace(/\0/g, '');
		const nickname = nicknameCharacters.join('').replace(/\0/g, '');
	
		return {
			sourceId,
			namesetId,
			nameType,
			name,
			nickname
		};
	}
		
	private parseUpdate(data) {
	
	}

	//TALLY SPECIFIC FUNCTIONS
	private processTally(tallyDataType: string, data) {
		if (tallyDataType === 'me') {
			console.log('processTally me', data);
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

			let addressPGM = data.a_source.toString();
			let addressPVW = data.b_source.toString();

			let bus = 'me' + data.ME_ID;

			for (let i = 0; i < device_sources.length; i++) {
				let deviceSourceObj = device_sources[i];
				if (deviceSourceObj.sourceId === this.source.id) { //this device_source is associated with the tally data of this source
					if (deviceSourceObj.bus === 'me' + data.ME_ID) { //the me of this contribution data
						if (deviceSourceObj.address === addressPGM) { //this device_source's address matches what was in the a_source field
							this.addTally(deviceSourceObj.address, bus, 'program');
						}
						else {
							this.removeTally(deviceSourceObj.address, bus, 'program');
						}
						if (device_sources[i].address === addressPVW) {
							this.addTally(deviceSourceObj.address, bus, 'preview');
						}
						else {
							this.removeTally(deviceSourceObj.address, bus, 'preview');
						}
					}
				}
			}

			//get array of unique device_source addresses for this source
			let uniqueAddresses = [...new Set(device_sources.filter(obj => obj.sourceId === this.source.id).map(obj => obj.address))];

			if (uniqueAddresses.length > 0) {
				for (let i = 0; i < uniqueAddresses.length; i++) {
					let address = uniqueAddresses[i];
					let busses = [];

					for (let j = 0; j < this.CTPtallydata.length; j++) {
						if (this.CTPtallydata[j].address === address) {
							if (this.CTPtallydata[j].busType === 'program') {
								busses.push('program');
								break; //no need to continue if it's in program in one place, that's enough
							}
							if (this.CTPtallydata[j].busType === 'preview') {
								busses.push('preview');
								break; //no need to continue if it's in preview in one place, that's enough
							}
						}
					}

					this.setBussesForAddress(address, busses);
				}
			}
		}
		else if (tallyDataType === 'output') {
			//console.log('processTally output', contributionData);
		}

		console.log('finished')
    }

    private addTally(address: string, bus: string, busType: string) {
        let found = false;

        for (let i = 0; i < this.CTPtallydata.length; i++) {
            if (this.CTPtallydata[i].address === address && this.CTPtallydata[i].bus === bus && this.CTPtallydata[i].busType === busType) {
                found = true;
				break;
            }
        }

        if (!found) { //if there was not an entry in the array for this address and bus and busType
            let tallyObj = {
                address: address,
                bus: bus,
				busType: busType
            };
            this.CTPtallydata.push(tallyObj);
        }
    }

    private removeTally(address: string, bus: string, busType: string) {
        for (let i = 0; i < this.CTPtallydata.length; i++) {
            if (this.CTPtallydata[i].address === address && this.CTPtallydata[i].bus === bus && this.CTPtallydata[i].busType === busType) {
                this.CTPtallydata.splice(i, 1);
				break;
            }
        }
    }

    public exit(): void {
        super.exit();
        this.server.close();
        FreePort(this.source.data.port, this.source.id);
        this.connected.next(false);
    }
}

/*
ROSS VISION MAPPING TO CTP

Input Table:

   InvalidSrc = 0
   FirstBNC   = 1
   LastBNC    = MAX_INPUTS //Max 92 In 93-96 are not tallied.
   Mle1  = 93
   Clean1 = 94
   Pvw1   = 97
   Pvw1b  = 98,    //Program Out before FTB.
   Mle2   = 99
   Clean2 = 100
   Pvw2   = 103
   Pvw2b  = 104,   //Program Out before FTB.
   Mle3   = 105
   Clean3 = 106
   Pvw3   = 109
   Pvw3b  = 110,   //Program Out before FTB.
   Mle4   = 111,   //Program MLE Output.
   Clean4 = 112,   //Clean Feed Output.
   Pvw4   = 115,   //Preview Bus (always).
   Pvw4b  = 116,   //Program Out before FTB.
   Test   = 117,   //Used for DVE Send—N/A in MD/X or QMD/X
   Black = 118
   Bkgd1 = 119
   Bkgd2 = 120
   StillFirst = 121
   GlbStoreLast = 123
   MLEStoreFirst = 125,  // MLE Stores are mapped to GVG Still 5,6,7,8
   StillLast  = 128,
   */