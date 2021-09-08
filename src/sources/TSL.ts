import { logger } from "..";
import { RegisterTallyInput } from "../_decorators/RegisterTallyInput.decorator";
import { FreePort, UsePort } from "../_decorators/UsesPort.decorator";
import { Source } from '../_models/Source';
import { TallyInputConfigField } from "../_types/TallyInputConfigField";
import { TallyInput } from './_Source';
import packet from 'packet';
import TSLUMD from 'tsl-umd';
import net from "net";
import dgram from "dgram";
import { jspack } from "jspack";

const TSLFields: TallyInputConfigField[] = [{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' }];

@RegisterTallyInput("5e0a1d8c", "TSL 3.1 UDP", "", TSLFields)
export class TSL3UDPSource extends TallyInput {
    private server: any;
    constructor(source: Source) {
        super(source);
        this.connected.next(true);

        let port = source.data.port;

        UsePort(port, this.source.id);
        this.server = new TSLUMD(port);

        this.server.on('message', (tally) => {
            const busses = [];
            if (tally.tally1) {
                busses.push("preview");
            }
            if (tally.tally2) {
                busses.push("program");
            }
            this.setBussesForAddress(tally.address, busses);
            
            this.sendTallyData();
        });

        this.connected.next(true);
    }

    public exit(): void {
        super.exit();
        this.server.close();
        UsePort(this.source.data.port, this.source.id);
        this.connected.next(false);
    }
}

@RegisterTallyInput("dc75100e", "TSL 3.1 TCP", "", TSLFields)
export class TSL3TCPSource extends TallyInput {
    private server: any;
    constructor(source: Source) {
        super(source);
        let port = source.data.port;

        let parser = packet.createParser();
        parser.packet('tsl', 'b8{x1, b7 => address},b8{x2, b2 => brightness, b1 => tally4, b1 => tally3, b1 => tally2, b1 => tally1 }, b8[16] => label');

        UsePort(port, this.source.id);
        this.server = net.createServer((socket) => {
            socket.on('data', (data) => {
                parser.extract('tsl', (result) => {
                    const busses = [];
                    if (result.tally1) {
                        busses.push("preview");
                    }
                    if (result.tally2) {
                        busses.push("program");
                    }
                    this.setBussesForAddress(result.address, busses);
                    
                    this.sendTallyData();
                });
                parser.parse(data);
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

class TSL5Base extends TallyInput {
    protected processTSL5Tally(data) {
        if (data.length > 12) {

            let tallyobj: any = {};

            var cursor = 0;

            //Message Format
            const _PBC = 2 //bytes
            const _VAR = 1
            const _FLAGS = 1
            const _SCREEN = 2
            const _INDEX = 2
            const _CONTROL = 2

            //Display Data
            const _LENGTH = 2

            tallyobj.PBC = jspack.Unpack( "<H", data, cursor);
            cursor += _PBC;

            tallyobj.VAR = jspack.Unpack( "<B", data, cursor);
            cursor += _VAR;

            tallyobj.FLAGS = jspack.Unpack( "<B", data, cursor);
            cursor += _FLAGS;

            tallyobj.SCREEN = jspack.Unpack( "<H", data, cursor);
            cursor += _SCREEN;

            tallyobj.INDEX = jspack.Unpack( "<H", data, cursor);
            cursor += _INDEX;

            tallyobj.CONTROL = jspack.Unpack( "<H", data, cursor);
            cursor += _CONTROL;

            tallyobj.control = {};
            tallyobj.control.rh_tally = (tallyobj.CONTROL >> 0 & 0b11);
            tallyobj.control.text_tally = (tallyobj.CONTROL >> 2 & 0b11);
            tallyobj.control.lh_tally = (tallyobj.CONTROL >> 4 & 0b11);
            tallyobj.control.brightness = (tallyobj.CONTROL >> 6 & 0b11);
            tallyobj.control.reserved = (tallyobj.CONTROL >> 8 & 0b1111111);
            tallyobj.control.control_data = (tallyobj.CONTROL >> 15 & 0b1);

            var LENGTH = jspack.Unpack( "<H", data, cursor)
            cursor += _LENGTH;

            tallyobj.TEXT = jspack.Unpack( "s".repeat(LENGTH), data, cursor)

            let inPreview = 0;
            let inProgram = 0;
            
            switch(tallyobj.control.text_tally) {
                case 0:
                    inPreview = 0;
                    inProgram = 0;
                    break;
                case 1:
                    inPreview = 0;
                    inProgram = 1;
                    break;
                case 2:
                    inPreview = 1;
                    inProgram = 0;
                    break;
                case 3:
                    inPreview = 1;
                    inProgram = 1;
                    break;
            }
            
            const busses = [];
            if (inPreview) {
                busses.push("preview");
            }
            if (inProgram) {
                busses.push("program");
            }
            this.setBussesForAddress(tallyobj.INDEX[0], busses);
            
            this.sendTallyData();
        }
    }
}

@RegisterTallyInput("54237da7", "TSL 5.0 UDP", "", TSLFields)
export class TSL5UDPSource extends TSL5Base {
    private server: any;
    constructor(source: Source) {
        super(source);
        let port = source.data.port;

        UsePort(port, this.source.id);
        this.server = dgram.createSocket('udp4');
        this.server.bind(port);

        this.server.on('message', (message) => {
            this.processTSL5Tally(message);
        });

        this.connected.next(true);
    }

    public exit(): void {
        super.exit();
        this.server.close();
        UsePort(this.source.data.port, this.source.id);
        this.connected.next(false);
    }
}

@RegisterTallyInput("560d3065", "TSL 5.0 TCP", "", TSLFields)
export class TSL5TCPSource extends TSL5Base {
    private server: any;
    constructor(source: Source) {
        super(source);

        let port = source.data.port;

        UsePort(port, this.source.id);
        this.server = net.createServer((socket) => {
            socket.on('data', (data) => {
                this.processTSL5Tally(data);
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
        this.server.close(() =>  {});
        FreePort(this.source.data.port, this.source.id);
        this.connected.next(false);
    }
}