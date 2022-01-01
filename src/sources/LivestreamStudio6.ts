import { logger } from "..";
import { RegisterTallyInput } from "../_decorators/RegisterTallyInput.decorator";
import { Source } from '../_models/Source';
import { TallyInput } from './_Source';
import net from "net";

//Based on https://github.com/bitfocus/companion-module-vimeo-livestreamstudio6/blob/main/src/index.js
//Thanks to @ChgoChad (https://github.com/ChgoChad)

@RegisterTallyInput("934b5102", "Livestream Studio6", "", [
    { fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' }
])
export class LivestreamStudio6Source extends TallyInput {
    private client: net.Socket;
    private ip: string;
    private port: number;
    private receiveBuffer = '';

    constructor(source: Source) {
        super(source);

        this.ip = source.data.ip;
        this.port = 9923;

        this.client = new net.Socket();

        this.client.on('error', (err) => {
            this.connected.next(false);
        });

        this.client.on('connect', () => {
            this.addAddress('{{STREAMING}}', '{{STREAMING}}');
            this.addAddress('{{RECORDING}}', '{{RECORDING}}');
            this.addAddress('{{FTB}}', '{{FTB}}');

            this.connected.next(true);
        });

        // separate buffered stream into lines with responses
        this.client.on('data', (chunk) => {
            let i = 0;
            let line = '';
            let offset = 0;
            this.receiveBuffer += chunk
            while ((i = this.receiveBuffer.indexOf('\n', offset)) !== -1) {
                line = this.receiveBuffer.substr(offset, i - offset)
                offset = i + 1
                this.client.emit('receiveline', line.toString())
            }
            this.receiveBuffer = this.receiveBuffer.substr(offset)
        });

        this.client.on('receiveline', (line) => {
            if (line !== undefined || line !== '') {
                // If verbose send received string to the log, except in the case of TrMSp & AVC
                // both of which return large amounts of data that would be excessive for the log
                logger(`Source: ${source.name}  Data received: ${line}`, 'info-quiet');
                this.parseIncomingAPI(line);
            } else {
                logger(`Source: ${source.name}  Data received was undefined or null.`, 'error');
            }
        });

        this.client.connect(this.port, this.ip);
    }

    private parseIncomingAPI(apiData: string) {
        const apiDataArr = apiData.trim().split(/:/);

        if (apiData !== undefined || apiData !== '') {
            switch (apiDataArr[0]) {                
                case 'StrStopped':
                    this.setBussesForAddress("{{STREAMING}}", []);
                    this.sendTallyData();
                    break;
                case 'StrStarted':
                    this.setBussesForAddress("{{STREAMING}}", ["program"]);
                    this.sendTallyData();
                    break;

                case 'RecStopped':
                    this.setBussesForAddress("{{RECORDING}}", []);
                    this.sendTallyData();
                    break;
                case 'RecStarted':
                    this.setBussesForAddress("{{RECORDING}}", ["program"]);
                    this.sendTallyData();
                    break;

                case 'FIn':
                    this.setBussesForAddress("{{FTB}}", ["program"]);
                    this.sendTallyData();
                    break;
                case 'FOut':
                    this.setBussesForAddress("{{FTB}}", []);
                    this.sendTallyData();
                    break;

                default:
                    break;
            }
        }
    }

    public reconnect() {
        this.client.connect(this.port, this.ip);
    }

    public exit(): void {
        super.exit();
        this.client.end();
    }
}
