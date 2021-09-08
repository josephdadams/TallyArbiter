import { logger } from "..";
import { RegisterTallyInput } from "../_decorators/RegisterTallyInput.decorator";
import { Source } from '../_models/Source';
import { TallyInput } from './_Source';
import net from "net";

@RegisterTallyInput("1190d7be", "Roland VR", "Uses Port 8023", [{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' }])
export class EditMeSource extends TallyInput {
    private client: any;
    constructor(source: Source) {
        super(source);
        let ip = source.data.ip;
        let port = 8023;

        this.client = new net.Socket();
        this.client.connect({ port: port, host: ip }, () => {
            let tallyCmd = '\u0002CPG:1;';
            this.client.write(tallyCmd + '\n');
            this.connected.next(true);
        });

        this.client.on('data', (data) => {
            try {
                let dataString = data.toString();
                if (dataString.indexOf('\u0002QPG:') > -1) {
                    //clear out any old tally values
                    this.removeBusFromAllAddresses("program")
                    //now enter the new PGM value based on the received data
                    const address = dataString.substring(dataString.length - 1, dataString.length - 2);
                    this.addBusToAddress(address, "program");
                    this.sendTallyData();
                }
            }
            catch (error) {
                logger(`Source: ${source.name}  Roland VR Connection Error occurred: ${error}`, 'error');
            }
        });

        this.client.on('close', () => {
            this.connected.next(false);
        });

        this.client.on('error', (error) => {
            logger(`Source: ${source.name}  Roland VR Connection Error occurred: ${error}`, 'error');
        });

        for (let i = 0; i < 4; i++) {
            this.addAddress(`INPUT ${i + 1}`, i.toString());
        }
        this.addAddress(`STILL`, "4");
    }


    public exit(): void {
        this.client.end();
        this.client.destroy();
    }
}
