import ObsWebSocket from 'obs-websocket-js';
import { logger } from '..';
import { RegisterTallyInput } from "../_decorators/RegisterTallyInput.decorator";
import { Source } from '../_models/Source';
import { TallyInput } from './_Source';

@RegisterTallyInput("4eb73542", "OBS", "The OBS Websocket plugin must be installed on the source.", [
    { fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
    { fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
    { fieldName: 'password', fieldLabel: 'Password', fieldType: 'text' }
])
export class OBSSource extends TallyInput {
    private obsClient: ObsWebSocket;
    constructor(source: Source) {
        super(source);
        let ip = source.data.ip;
        let port = source.data.port;
        let password = source.data.password;


        logger(`Source: ${source.name}  Creating OBS Websocket connection.`, 'info-quiet');
        this.obsClient = new ObsWebSocket();

        this.obsClient.connect({ address: ip + ':' + port, password: password }).then((data) => {
            logger(`Source: ${source.name} Connected to OBS @ ${ip}:${port}`, 'info');
        })
            .catch(function (error) {
                if (error.code === 'CONNECTION_ERROR') {
                    logger(`Source: ${source.name}  OBS websocket connection error. Is OBS running?`, 'error');
                }
            });

        this.obsClient.on('ConnectionOpened', () => {
            logger(`Source: ${source.name}  OBS Connection opened.`, 'info');
            this.addAddress('{{STREAMING}}', '{{STREAMING}}');
            this.addAddress('{{STREAMING}}', '{{RECORDING}}');
            //Retrieve all the current sources and add them
            this.obsClient.send('GetSourcesList').then((data) => {
                if (!Array.isArray(data.sources)) return;
                for (const source of data.sources) {
                    this.addAddress(source, source);
                }
            }).catch(() => undefined);
            this.connected.next(true);
        });

        this.obsClient.on('ConnectionClosed', () => {
            logger(`Source: ${source.name} OBS Connection closed.`, 'info');
            this.connected.next(false);
        });

        this.obsClient.on('AuthenticationSuccess', () => {
            logger(`Source: ${source.name}  OBS Authenticated.`, 'info-quiet');
            this.connected.next(false);
        });

        this.obsClient.on('AuthenticationFailure', () => {
            logger(`Source: ${source.name}  Invalid OBS Password.`, 'info');
            this.connected.next(false);
        });

        this.obsClient.on('PreviewSceneChanged', (data) => {
            logger(`Source: ${source.name}  Preview Scene Changed.`, 'info-quiet');
            if (data) {
                if (data.sources) {
                    // this.processOBSTally(data.sources, 'preview');
                }
            }
        });

        this.obsClient.on('SwitchScenes', (data) => {
            logger(`Source: ${source.name}  Program Scene Changed.`, 'info-quiet');
            if (data) {
                if (data.sources) {
                    // this.processOBSTally(data.sources, 'program');
                }
            }
        });

        this.obsClient.on('SourceCreated', (data) => {
            logger(`Source: ${source.name}  New source created`, 'info-quiet');
            this.addAddress(data.sourceName, data.sourceName);
        });

        this.obsClient.on('SourceDestroyed', (data) => {
            logger(`Source: ${source.name} Deleted source: ${data.sourceName}`, 'info-quiet');
            this.removeAddress(data.sourceName);
        });

        this.obsClient.on('SourceRenamed', (data) => {
            logger(`Source: ${source.name}  Source renamed`, 'info-quiet');
            this.renameAddress(data.previousName, data.newName, data.newName);
        });

        this.obsClient.on('StreamStarted', () => {
            let obsTally = [
                {
                    name: '{{STREAMING}}',
                    render: true
                }
            ];
            // this.processOBSTally(obsTally, 'program');
        });

        this.obsClient.on('StreamStopped', function () {
            let obsTally = [
                {
                    name: '{{STREAMING}}',
                    render: false
                }
            ];
            this.processOBSTally(obsTally, 'program');
        });

        this.obsClient.on('RecordingStarted', function () {
            let obsTally = [
                {
                    name: '{{RECORDING}}',
                    render: true
                }
            ];
            this.processOBSTally(obsTally, 'program');
        });

        this.obsClient.on('RecordingStopped', function () {
            let obsTally = [
                {
                    name: '{{RECORDING}}',
                    render: false
                }
            ];
            this.processOBSTally(obsTally, 'program');
        });

    }


    public exit(): void {
        logger(`Source: ${this.source.name}  Closing OBS connection.`, 'info-quiet');
        this.obsClient.disconnect();
    }
}
