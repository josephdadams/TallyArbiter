import { logger } from "..";
import { RegisterAction } from "../_decorators/RegisterAction";
import { TallyInputConfigField } from "../_types/TallyInputConfigField";
import { Action } from "./_Action";
import dgram from 'dgram';
import net from 'net';


const TSLFields: TallyInputConfigField[] = [ //TSL 3.1 UDP
    { fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
    { fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
    { fieldName: 'address', fieldLabel: 'Address', fieldType: 'number' },
    { fieldName: 'label', fieldLabel: 'Label', fieldType: 'text' },
    { fieldName: 'tally1', fieldLabel: 'Tally 1 (PVW)', fieldType: 'bool' },
    { fieldName: 'tally2', fieldLabel: 'Tally 2 (PGM)', fieldType: 'bool' },
    { fieldName: 'tally3', fieldLabel: 'Tally 3', fieldType: 'bool' },
    { fieldName: 'tally4', fieldLabel: 'Tally 4', fieldType: 'bool' }
]


@RegisterAction("7dcd66b5", "TSL 3.1 UDP", TSLFields)
@RegisterAction("276a8dcc", "TSL 3.1 TCP", TSLFields)
export class TSL extends Action {
    public run(): void {
        try {
            let bufUMD = Buffer.alloc(18, 0); //ignores spec and pad with 0 for better aligning on Decimator etc
            bufUMD[0] = 0x80 + parseInt(this.action.data.address);
            bufUMD.write(this.action.data.label, 2);
    
            let bufTally = 0x30;
    
            if (this.action.data.tally1) {
                bufTally |= 1;
            }
            if (this.action.data.tally2) {
                bufTally |= 2;
            }
            if (this.action.data.tally3) {
                bufTally |= 4;
            }
            if (this.action.data.tally4) {
                bufTally |= 8;
            }
            bufUMD[1] = bufTally;
    
            if (this.action.outputTypeId == "7dcd66b5") {
                // UDP
                let client = dgram.createSocket('udp4');
                client.send(bufUMD, this.action.data.port, this.action.data.ip, function(error) {
                    if (!error) {
                        logger(`TSL 3.1 UDP Data sent.`, 'info');
                    }
                    client.close();
                });
            } else {
                // TCP
                let client = new net.Socket();
                client.connect(this.action.data.port, this.action.data.ip, () =>  {
                    client.write(bufUMD);
                });
        
                client.on('data', () => {
                    client.destroy(); // kill client after server's response
                });
        
                client.on('close', () =>  {
                });
            }
        } catch (error) {
            logger(`An error occured sending the TCP 3.1 ${this.action.outputTypeId == "7dcd66b5" ? "UDP" : "TCP"} Message: ${error}`, 'error');
        }
    }
}
