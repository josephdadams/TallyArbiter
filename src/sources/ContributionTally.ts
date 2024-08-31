import { RegisterTallyInput } from "../_decorators/RegisterTallyInput.decorator";
import { FreePort, UsePort } from "../_decorators/UsesPort.decorator";
import { Source } from '../_models/Source';
import { TallyInputConfigField } from "../_types/TallyInputConfigField";
import { TallyInput } from './_Source';
import net from "net";
import dgram from "dgram";
import { jspack } from "jspack";

const CTPFields: TallyInputConfigField[] = [{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' }];

@RegisterTallyInput("b4f626a6", "GV Contribution Tally UDP", "", CTPFields)
export class CTPUDPSource extends TallyInput {
    private server: any;
    constructor(source: Source) {
        super(source);
        this.connected.next(true);

        let port = source.data.port;

        UsePort(port, this.source.id);
		this.server = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        this.server.on('message', (data) => {
            processCTPTally(data);
        });

		this.server.on('listening', function(){
			var address = this.server.address();
            console.log("listening on :" + address.address + ":" + address.port);
		});
		
		this.server.bind(port);

        this.connected.next(true);
    }

    public exit(): void {
        super.exit();
        this.server.close();
        FreePort(this.source.data.port, this.source.id);
        this.connected.next(false);
    }
}

@RegisterTallyInput("9501c3fc", "GV Contribution Tally TCP", "", CTPFields)
export class CTPTCPSource extends TallyInput {
    private server: any;
    constructor(source: Source) {
        super(source);

        let port = source.data.port;

        UsePort(port, this.source.id);

        this.server = net.createServer((socket) => {
            socket.on('data', (data) => {
				processCTPTally.bind(this)(data);
            });

            socket.on('close', () => {
                this.connected.next(false);
            });
        }).listen(port, () => {
            this.connected.next(true);
        });
    }

    public exit(): void {
        super.exit();
        this.server.close(() => { });
        FreePort(this.source.data.port, this.source.id);
        this.connected.next(false);
    }
}

function processCTPTally(data) {
	let self = this;

	const sections = parseHexData(data.toString('hex'));

	sections.forEach((section, index) => {
		switch (section.commandCode) {
			case 0x8: // ME Contribution
				processTally.bind(self)(section.data);
				break;
			case 0x9: // External Proc Contribution
				//console.log("External Proc Contribution", section);
				break;
			case 0xA: // Still Store Contribution
				//console.log("Still Store Contribution", section);
				break;
			case 0xB: // Outputs Status
				//console.log("Outputs Status", section);
				break;
			case 0xC: // Source Name
				self.renameAddress(section.data.sourceId.toString(), section.data.sourceId.toString(), section.data.sourceId.toString() + ": " + section.data.name);
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
}

function parseHexData(hexData) {
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
				parsedData = parseMEContribution(section.data, section.instanceID);
				break;
			case 0x9: // External Proc Contribution
				parsedData = parseExternalProcContribution(section.data);
				break;
			case 0xA: // Still Store Contribution
				parsedData = parseStillStoreContribution(section.data);
				break;
			case 0xB: // Outputs Status
				parsedData = parseOutputsStatus(section.data);
				break;
            case 0xC: // Source Name
                parsedData = parseSourceName(section.data, section.instanceID);
                break;
			case 0xD: // Update
				parsedData = parseUpdate(section.data);
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

function processTally(contributionData) {
    let self = this;

	if (contributionData.ME_ID === 4) {
		console.log('processTally', contributionData);
		//a_source = pgm, b_source = pvw

		let addressPGM = contributionData.a_source.toString();
		let addressPVW = contributionData.b_source.toString();

		let bussesPGM = [];
		let bussesPVW = [];

		//if they are the same, put the address in pvw and pgm
		if (addressPGM === addressPVW) {
			bussesPGM.push("preview");
			bussesPGM.push("program");
			self.setBussesForAddress(addressPGM, bussesPGM);

			//self.sendIndividualTallyData(addressPGM.toString(), bussesPGM);
		} else {
			bussesPGM.push("program");
			self.setBussesForAddress(addressPGM, bussesPGM);

			bussesPVW.push("preview");
			self.setBussesForAddress(addressPVW, bussesPVW);

			//self.sendIndividualTallyData(addressPGM.toString(), bussesPGM);
			//self.sendIndividualTallyData(addressPVW.toString(), bussesPVW);
		}

		self.sendTallyData();
	}
}

function parseMEContribution(data, me_id) {
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

function parseExternalProcContribution(data) {

}

function parseStillStoreContribution(data) {
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

function parseOutputsStatus(data) {
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

function parseSourceName(data, namesetId) {
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


function parseUpdate(data) {

}


/*
ROSS VISION MAPPING TO CTP

Output Table:

   NONE    = 0,
   Aux1    = 1, // 1:1
   Aux2    = 2,
   Aux3    = 3,
   Aux4    = 4, // 1:4
   Pgm     = 5,
   Pvw     = 6,
   Clean   = 7,
   Aux5    = 8, // 1:5
   Aux6    = 9,
   Aux7    = 10,
   Aux8    = 11,
   Aux9    = 12,  // 2:1
   Aux10   = 13,
   Aux11   = 14,
   Aux12   = 15,
   Aux13   = 16,
   Aux14   = 17,
   Aux15   = 18,
   Aux16   = 19, // 2:8
   Aux17   = 20, // 3:1
   Aux18   = 21,
   Aux19   = 22,
   Aux20   = 23,
   Aux21   = 24,
   Aux22   = 25,
   Aux23   = 26,
   Aux24   = 27, // 3:8
   Aux25   = 28, // 4:1
   Aux26   = 29,
   Aux27   = 30,
   Aux28   = 31,
   Aux29   = 32,
   Aux30   = 33,
   Aux31   = 34,
   Aux32   = 35, // 4:8
   Aux33   = 36, // 5:1
   Aux34   = 37,
   Aux35   = 38,
   Aux36   = 39,
   Aux37   = 40,
   Aux38   = 41,
   Aux39   = 42,
   Aux40   = 43, // 5:8
   Aux41   = 44, // 6:1
   Aux42   = 45,
   Aux43   = 46,
   Aux44   = 47,
   Aux45   = 48, // 6:5

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