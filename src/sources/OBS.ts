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
    private scenes: ObsWebSocket.Scene[] = [];
    constructor(source: Source) {
        super(source);
        this.obsClient = new ObsWebSocket();

        this.obsClient.on('ConnectionClosed', () => {
            this.connected.next(false);
        });

        this.obsClient.on('AuthenticationSuccess', () => {
            logger(`Source: ${source.name}  OBS Authenticated.`, 'info-quiet');
            this.obsClient.send('GetSourcesList').then((data: any) => {
                if (!Array.isArray(data.sources)) return;
                for (const source of data.sources) {
                    this.addAddress(source.name, source.name);
                }
            });
            this.saveSceneList();
            let previewScenePromise = this.obsClient.send('GetPreviewScene');
            let programScenePromise = this.obsClient.send('GetCurrentScene');
            let streamingAndRecordingStatusPromise = this.obsClient.send('GetStreamingStatus');
            let replayBufferStatusPromise = this.obsClient.send('GetReplayBufferStatus');
            Promise.all([
                previewScenePromise, programScenePromise, streamingAndRecordingStatusPromise, replayBufferStatusPromise
            ]).then((data) => {
                let [previewScene, programScene, streamingAndRecordingStatus, replayBufferStatus]: any = data;

                this.processSceneChange(previewScene.sources, 'preview');
                this.processSceneChange(programScene.sources, 'program');
                
                this.addAddress('{{STREAMING}}', '{{STREAMING}}');
                this.addAddress('{{RECORDING}}', '{{RECORDING}}');
                this.addAddress('{{VIRTUALCAM}}', '{{VIRTUALCAM}}');
                this.addAddress('{{REPLAY}}', '{{REPLAY}}');
                if(streamingAndRecordingStatus.streaming) this.setBussesForAddress("{{STREAMING}}", ["program"]);
                if(streamingAndRecordingStatus.recording) {
                    if(streamingAndRecordingStatus.recordingPaused) {
                        this.setBussesForAddress("{{RECORDING}}", ["preview"]);
                    } else {
                        this.setBussesForAddress("{{RECORDING}}", ["program"]);
                    }
                }
                if(streamingAndRecordingStatus.virtualcam) this.setBussesForAddress("{{VIRTUALCAM}}", ["program"]);
                if(replayBufferStatus.isReplayBufferActive) this.setBussesForAddress("{{REPLAY}}", ["program"]);

                this.sendTallyData();
                this.connected.next(true);
            }).catch((error) => {
                console.error(error);
            });
        });

        this.obsClient.on('AuthenticationFailure', () => {
            logger(`Source: ${source.name}  Invalid OBS Password.`, 'info');
            this.connected.next(false);
        });

        this.obsClient.on('PreviewSceneChanged', (data) => {
            logger(`Source: ${source.name}  Preview Scene Changed.`, 'info-quiet');
            if (data?.sources) {
                this.removeBusFromAllAddresses("preview");
                this.processSceneChange(data?.sources, "preview");
                this.sendTallyData();
            }
        });
        
        this.obsClient.on('SwitchScenes', (data) => {
            logger(`Source: ${source.name}  Program Scene Changed.`, 'info-quiet');
            if (data?.sources) {
                this.removeBusFromAllAddresses("program");
                this.processSceneChange(data?.sources, "program");
                this.sendTallyData();
            }
        });

        this.obsClient.on('SourceCreated', (data) => {
            logger(`Source: ${source.name}  New source created`, 'info-quiet');
            this.addAddress(data.sourceName, data.sourceName);
            this.saveSceneList();
        });

        this.obsClient.on('SourceDestroyed', (data) => {
            logger(`Source: ${source.name} Deleted source: ${data.sourceName}`, 'info-quiet');
            this.removeAddress(data.sourceName);
            this.saveSceneList();
        });

        this.obsClient.on('SourceRenamed', (data) => {
            logger(`Source: ${source.name}  Source renamed`, 'info-quiet');
            this.renameAddress(data.previousName, data.newName, data.newName);
            this.saveSceneList();
        });

        this.obsClient.on('SceneCollectionChanged', (data) => {
            this.saveSceneList();
        });

        this.obsClient.on('StreamStarted', () => {
            this.setBussesForAddress("{{STREAMING}}", ["program"]);
            this.sendTallyData();
        });

        this.obsClient.on('StreamStopped', () => {
            this.setBussesForAddress("{{STREAMING}}", []);
            this.sendTallyData();
        });

        this.obsClient.on('RecordingStarted', () => {
            this.setBussesForAddress("{{RECORDING}}", ["program"]);
            this.sendTallyData();
        });

        this.obsClient.on('RecordingPaused', () => {
            this.setBussesForAddress("{{RECORDING}}", ["preview"]);
            this.sendTallyData();
        });

        this.obsClient.on('RecordingResumed', () => {
            this.setBussesForAddress("{{RECORDING}}", ["program"]);
            this.sendTallyData();
        });

        this.obsClient.on('RecordingStopped', () => {
            this.setBussesForAddress("{{RECORDING}}", []);
            this.sendTallyData();
        });

        this.obsClient.on('VirtualCamStarted', () => {
            this.setBussesForAddress("{{VIRTUALCAM}}", ["program"]);
            this.sendTallyData();
        });

        this.obsClient.on('VirtualCamStopped', () => {
            this.setBussesForAddress("{{VIRTUALCAM}}", []);
            this.sendTallyData();
        });

        this.obsClient.on('ReplayStarted', () => {
            this.setBussesForAddress("{{REPLAY}}", ["program"]);
            this.sendTallyData();
        });

        this.obsClient.on('ReplayStopped', () => {
            this.setBussesForAddress("{{REPLAY}}", []);
            this.sendTallyData();
        });

        
        this.connect();
    }

    private saveSceneList() {
        this.obsClient.send('GetSceneList').then((data) => {
            this.scenes = data.scenes;
        });
    }

    private processSceneChange(sources: ObsWebSocket.SceneItem[], bus: string) {
        if (sources) {
            for (const source of sources) {
                this.addBusToAddress(source.name, bus);
                if(source.type === "scene"){
                    let nested_scene = this.scenes.find(scene => scene.name === source.name);
                    if(nested_scene) {
                        this.processSceneChange(nested_scene.sources, bus);
                    }
                }
            }
        }
    }

    private connect() {
        this.obsClient.connect({ address: this.source.data.ip + ':' + this.source.data.port, password: this.source.data.password })
            .catch((error) => {
                if (error.code === 'CONNECTION_ERROR') {
                    logger(`Source: ${this.source.name}  OBS websocket connection error. Is OBS running?`, 'error');
                    this.connected.next(false);
                }
            });
    }

    public reconnect() {
        this.connect();
    }


    public exit(): void {
        super.exit();
        this.obsClient.disconnect();
    }
}
