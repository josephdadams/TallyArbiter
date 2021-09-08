import { logger } from "..";
import { RegisterTallyInput } from "../_decorators/RegisterTallyInput.decorator";
import { Source } from '../_models/Source';
import { TallyInput } from './_Source';
import net from "net";
import xml2js from 'xml2js';

@RegisterTallyInput("f2b7dc72", "Newtek Tricaster", "Uses Port 5951.", [{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' }])
export class NewtekTricasterSource extends TallyInput {
    private client: any;
    private tallydata_TC: any[] = [];
    constructor(source: Source) {
        super(source);
        let ip = source.data.ip;
        let port = 5951;

        logger(`Source: ${source.name}  Creating Tricaster Connection.`, 'info-quiet');
        this.client = new net.Socket();
        this.client.connect({ port: port, host: ip }, () => {
            let tallyCmd = '<register name="NTK_states"/>';
            this.client.write(tallyCmd + '\n');
            logger(`Source: ${source.name}  Tricaster Connection opened. Listening for data.`, 'info');
            this.connected.next(true);
        });

        this.client.on('data', (data) => {
            try {
                data = '<data>' + data.toString() + '</data>';

                let parseString = xml2js.parseString;

                parseString(data, (error, result) => {
                    if (error) {
                        //the Tricaster will send a lot of data that will not parse correctly when it first connects
                        //console.log('error:' + error);
                    }
                    else {
                        let shortcut_states = Object.entries(result['data']['shortcut_states']);

                        for (const [name, value] of shortcut_states) {
                            let shortcut_state = value['shortcut_state'];
                            for (let j = 0; j < shortcut_state.length; j++) {
                                switch (shortcut_state[j]['$'].name) {
                                    case 'program_tally':
                                    case 'preview_tally':
                                        let tallyValue = shortcut_state[j]['$'].value;
                                        let addresses = tallyValue.split('|');
                                        this.processTricasterTally(addresses, shortcut_state[j]['$'].name);
                                        break;
                                    default:
                                        break;
                                }
                            }
                        }
                    }
                });
            }
            catch (error) {

            }
        });

        this.client.on('close', () => {
            logger(`Source: ${source.name}  Tricaster Connection Stopped.`, 'info');
            this.connected.next(false);
        });

        this.client.on('error', function (error) {
            logger(`Source: ${source.name}  Tricaster Connection Error occurred: ${error}`, 'error');
        });
    }

    
    public processTricasterTally(sourceId, sourceArray, tallyType?) {
        for (let i = 0; i < sourceArray.length; i++) {
            let tricasterSourceFound = false;
            for (let j = 0; j < this.tallydata_TC.length; j++) {
                if (this.tallydata_TC[j].sourceId === sourceId) {
                    if (this.tallydata_TC[j].address === sourceArray[i]) {
                        tricasterSourceFound = true;
                        break;
                    }
                }
            }
    
            if (!tricasterSourceFound) {
                //the source is not in the Tricaster array, we don't know anything about it, so add it to the array
                let tricasterTallyObj: any = {};
                tricasterTallyObj.sourceId = sourceId;
                tricasterTallyObj.label = sourceArray[i];
                tricasterTallyObj.address = sourceArray[i];
                tricasterTallyObj.tally4 = 0;
                tricasterTallyObj.tally3 = 0;
                tricasterTallyObj.tally2 = 0; // PGM
                tricasterTallyObj.tally1 = 0; // PVW
                tricasterTallyObj.preview = 0;
                tricasterTallyObj.program = 0;
                this.tallydata_TC.push(tricasterTallyObj);
                this.addAddress(sourceArray[i], sourceArray[i]);
            }
        }
    
        for (let i = 0; i < this.tallydata_TC.length; i++) {
            let tricasterSourceFound = false;
            for (let j = 0; j < sourceArray.length; j++) {
                if (this.tallydata_TC[i].sourceId === sourceId) {
                    if (this.tallydata_TC[i].address === sourceArray[j]) {
                        tricasterSourceFound = true;
                        //update the tally state because Tricaster is saying this source is in the current bus
                        switch(tallyType) {
                            case 'preview_tally':
                                this.tallydata_TC[i].tally1 = 1;
                                this.tallydata_TC[i].preview = 1;
                                this.addBusToAddress(sourceArray[i], "preview");
                                break;
                            case 'program_tally':
                                this.tallydata_TC[i].tally2 = 1;
                                this.tallydata_TC[i].program = 1;
                                this.addBusToAddress(sourceArray[i], "program");
                                break;
                            default:
                                break;
                        }
                        break;
                    }
                }
            }
    
            if (!tricasterSourceFound) {
                //it is no longer in the bus, mark it as such
                switch(tallyType) {
                    case 'preview_tally':
                        this.tallydata_TC[i].tally1 = 0;
                        this.tallydata_TC[i].preview = 0;
                        this.removeBusFromAddress(sourceArray[i], "preview");
                        break;
                    case 'program_tally':
                        this.tallydata_TC[i].tally2 = 0;
                        this.tallydata_TC[i].program = 0;
                        this.removeBusFromAddress(sourceArray[i], "program");
                        break;
                    default:
                        break;
                }
            }
        }
        this.sendTallyData();
    }


    public exit(): void {
        let tallyCmd = '<unregister name="NTK_states"/>';
        this.client.write(tallyCmd + '\n');
        this.client.end();
        this.client.destroy();
    }
}
