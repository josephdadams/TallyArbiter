import { logger } from "..";
import { RegisterTallyInput } from "../_decorators/RegisterTallyInput.decorator";
import { FreePort, UsePort } from "../_decorators/UsesPort.decorator";
import { Source } from '../_models/Source';
import { TallyInputConfigField } from "../_types/TallyInputConfigField";
import { TallyInput } from './_Source';
import packet from 'packet';
import net from "net";
import dgram from "dgram";
import { jspack } from "jspack";
import hexdump from 'hexdump-nodejs';

@RegisterTallyInput("59a3c890", "Snell K360", "Uses port 50009 or 50001? normally", [
    { fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
    { fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
])
export class SnellK360Source extends TallyInput {
    private client: any;
    private port: number;  // AnalogWay Livecore TCP port number
    private last_heartbeat: number;
//    private tallydata_snellk360: any[] = [];
    private heartbeat_interval: NodeJS.Timer;
    constructor(source: Source) {
        super(source);
        this.port = source.data.port;

        this.client = new net.Socket();

        let parser = packet.createParser();
//        parser.packet('k360', "b8 => type, b16 => zero1, b8 => unknown1, b8 => unknown2, b8 => me, b16 => address, b32 => tally, b8[12]{0}z|str('ascii') => label");
        parser.packet('k360', "b8 => command, b16 => zero1, b8 => direction, b8 => type, b8 => me, b16 => address, b8{b1 => tally8, b1 => tally7, b1 => tally6, b1 => tally5, b1 => tally4, b1 => tally3, b1 => tally2, b1 => tally1}, b8 => maybetally1, b8 => maybetally2, b8 => maybetally3, b8[12]{0}z|str('ascii') => label");

        this.client.on('connect', () => {
            this.connected.next(true);

            this.last_heartbeat = Date.now();
            this.heartbeat_interval = setInterval(() => {
                if (Date.now() - this.last_heartbeat > 5000) {
                    clearInterval(this.heartbeat_interval);
                    logger(`Source: ${source.name}  Snell K360 connection heartbeat timed out`, 'error');
//                    this.client.end();
//                    this.client.destroy();
//                    this.connected.next(false);
                }
            }, 1000);
        });

        this.client.on('data', (data) => {
            logger(`Source: ${source.name}  Snell K360 data received ${data.length} bytes.`, 'info-quiet');
//            logger('\n' + hexdump(data), 'info-quiet');
            parser.extract('k360', (result) => {
                this.last_heartbeat = Date.now();
                if (result.command == 241) {
                    logger(`Got "${result.label}" AKA ${result.address} on ME ${result.me} of direction ${result.direction} and type ${result.type}`, 'info-quiet');

                    if (result.zero1 != 0) {
                        logger(`Got non-zero zero1`, 'info-quiet');
                        logger(hexdump(data), 'info-quiet');
                    }

                    if (result.direction == 0 && result.type == 1) {
                        this.addAddress(result.label, result.address);

                        const busses = [];
                        if (result.tally8) {
                            busses.push("program");
                        }
                        if (result.tally7) {
                            busses.push("preview");
                        }
                        // TODO: Handle MEs/Stores etc?
                        this.setBussesForAddress(result.address, busses);

                        this.sendTallyData();
                    }
                } else {
                    logger(`Got unexpected command ${result.command}`, 'info-quiet');
                    logger(hexdump(data), 'info-quiet');
                }
//                logger(`Remaining buffer size ${data.length}`, 'info-quiet');
            });

            parser.parse(data);
        });

        this.client.on('close', () => {
            this.connected.next(false);
        });

        this.client.on('error', (error) => {
            logger(`Source: ${source.name}  Snell K360 Connection Error occurred: ${error}`, 'error');
        });

        this.connect();
    }


    private connect(): void {
        this.client.connect(this.port, this.source.data.ip);
    }


    public reconnect(): void {
        this.connect();
    }


    public exit(): void {
        super.exit();
        clearInterval(this.heartbeat_interval);
        this.client.end();
        this.client.destroy();
        this.connected.next(false);
    }
}
