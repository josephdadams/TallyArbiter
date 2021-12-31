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

    constructor(source: Source) {
        super(source);

        this.ip = source.data.ip;
        this.port = 9923;

        this.client = new net.Socket();

        this.client.on('error', (err) => {
            this.connected.next(false);
        });

        this.client.on('connect', () => {
            this.connected.next(true);
        });

        // separate buffered stream into lines with responses
        this.client.on('data', (chunk) => {
            let i = 0;
            let line = '';
            let offset = 0;
            receiveBuffer += chunk
            while ((i = receiveBuffer.indexOf('\n', offset)) !== -1) {
                line = receiveBuffer.substr(offset, i - offset)
                offset = i + 1
                this.client.emit('receiveline', line.toString())
            }
            receiveBuffer = receiveBuffer.substr(offset)
        });

        this.client.on('receiveline', (line) => {
            if (line !== undefined || line !== '') {
                // If verbose send received string to the log, except in the case of TrMSp & AVC
                // both of which return large amounts of data that would be excessive for the log
                if (self.config.verbose &&
                    !line.startsWith('TrMSp') &&
                    !line.startsWith('TrASp') &&
                    !line.startsWith('AVC')
                ) {
                    logger(`Source: ${source.name}  Data received: ${line}`, 'debug');
                }
                //self.parseIncomingAPI(line);
            } else {
                logger(`Source: ${source.name}  Data received was undefined or null.`, 'error');
            }
        });

        this.client.connect(this.ip, this.port);
    }

    public reconnect() {
        this.client.connect(this.ip, this.port);
    }

    public exit(): void {
        super.exit();
        this.client.end();
    }
}
