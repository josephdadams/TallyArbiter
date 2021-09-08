import { logger } from "..";
import { RegisterTallyInput } from "../_decorators/RegisterTallyInput.decorator";
import { Source } from '../_models/Source';
import { TallyInput } from './_Source';
import net from "net";

@RegisterTallyInput("58b6af42", "VMix", "Uses Port 8099.", [{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' }])
export class VMixSource extends TallyInput {
    private client: any;
    constructor(source: Source) {
        super(source);
        let ip = source.data.ip;
        let port = 8099;


        logger(`Source: ${source.name}  Creating VMix connection.`, 'info-quiet');
        this.client = new net.Socket();
        this.client.connect(port, ip, () => {
            logger(`Source: ${source.name}  VMix Connection Opened.`, 'info');

            this.client.write('SUBSCRIBE TALLY\r\n');
            this.client.write('SUBSCRIBE ACTS\r\n');

            this.addAddress('Recording', '{{RECORDING}}');
            this.addAddress('Streaming', '{{STREAMING}}');
            this.connected.next(true);
        });

        this.client.on('data', (data) => {
            logger(`Source: ${source.name}  VMix data received.`, 'info-quiet');
            data = data
                .toString()
                .split(/\r?\n/);

            const tallyData = data.filter(text => text.startsWith('TALLY OK'));

            if (tallyData.length > 0) {
                logger(`Source: ${source.name}  VMix tally data received.`, 'info-quiet');
                for (let j = 9; j < tallyData[0].length; j++) {
                    let address = j - 9 + 1;
                    let value = tallyData[0].charAt(j);

                    this.addAddress(`Input ${address}`, address.toString());
                    const busses = [];
                    if (value === "2") {
                        busses.push("preview");
                    }
                    if (value === "1") {
                        busses.push("program");
                    }
                    this.setBussesForAddress(address.toString(), busses);
                }
            }
            else {
                //we received some other command, so lets process it
                if (data[0].indexOf('ACTS OK Recording ') > -1) {
                    this.setBussesForAddress("{{RECORDING}}", []);
                    if (data.indexOf('ACTS OK Recording 1') > -1) {
                        this.setBussesForAddress("{{RECORDING}}", ["program"]);
                    }
                }

                if (data[0].indexOf('ACTS OK Streaming ') > -1) {
                    this.setBussesForAddress("{{STREAMING}}", []);
                    if (data.indexOf('ACTS OK Streaming 1') > -1) {
                        this.setBussesForAddress("{{STREAMING}}", ["program"]);
                    }
                }
            }
        });

        this.client.on('error', (error) => {
            logger(`Source: ${source.name}  VMix Connection Error occurred: ${error}`, 'error');
        });

        this.client.on('close', () => {
            logger(`Source: ${source.name}  VMix Connection closed.`, 'info');
            this.connected.next(false);
        });
    }

    public exit(): void {
        logger(`Source: ${this.source.name}  Closing VMix connection.`, 'info-quiet');
        this.client.write('QUIT\r\n');
    }
}
