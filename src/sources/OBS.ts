import { default as ObsWebSocket4 } from 'obs-websocket-js';
import ObsWebSocket5 from 'obs-websocket-js-5';
import { logger } from '..';
import { RegisterTallyInput } from "../_decorators/RegisterTallyInput.decorator";
import { Source } from '../_models/Source';
import { TallyInput } from './_Source';

@RegisterTallyInput("4eb73542", "OBS", "The OBS Websocket plugin must be installed on the source.", [
    { fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
    { fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
    { fieldName: 'password', fieldLabel: 'Password', fieldType: 'text', optional: true },
    { fieldName: 'version', fieldLabel: 'OBS Websocket plugin version', fieldType: 'dropdown', options: [
        { id: '4', label: 'v4.x.x' },
        { id: '5', label: 'v5.x.x' }
    ]}
])
export class OBSSource extends TallyInput {
    private version: "4" | "5";

    private obsClient: ObsWebSocket4;
    private scenes: ObsWebSocket4.Scene[] = [];
    private isTransitionFinished = true;
    private currentTransitionFromScene: ObsWebSocket4.Scene = undefined;
    private currentPreviewScene: string = "";
    private currentProgramScene: string = "";
    constructor(source: Source) {
        super(source);

        if(typeof source.data.version === "undefined") {
            this.version = "4";
        } else {
            this.version = source.data.version;
        }

        if(this.version === "4") {
            this.initialize_v4(source);
        } else {
            this.initialize_v5(source);
        }
    }

    private initialize_v4(source: Source) {
        this.obsClient = new ObsWebSocket4();

        this.obsClient.on('ConnectionClosed', () => {
            this.connected.next(false);
        });

        this.obsClient.on('AuthenticationSuccess', async () => {
            logger(`Source: ${source.name}  OBS Authenticated.`, 'info-quiet');
            this.obsClient.send('EnableStudioMode').then(() => {
            }).catch((error) => {
                if(error.error !== 'studio mode already active') {
                    logger(`Source: ${source.name}  OBS Studio Mode Error ${error.error}.`, 'error');
                }
            });

            this.saveSceneList();

            let sourcesListPromise = this.obsClient.send('GetSourcesList');
            let sourceTypesListPromise = this.obsClient.send('GetSourceTypesList');
            Promise.all([sourceTypesListPromise, sourcesListPromise]).then((data) => {
                let [sourceTypesList, sourcesList]: any = data;
                let sourceTypesWithAudio: string[] = [];

                sourceTypesList.types.forEach((type) => {
                    if(type.caps.hasAudio){
                        sourceTypesWithAudio.push(type.typeId);
                    }    
                });

                if (!Array.isArray(sourcesList.sources)) return;
                for (const source of sourcesList.sources) {
                    this.addAddress(source.name, source.name);
                    if(sourceTypesWithAudio.includes(source.typeId)){
                        this.obsClient.send('GetMute', {
                            source: source.name
                        }).then((data) => {
                            this.processMutedState(data.name, data.muted);
                        });
                    }
                }
            });

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
                logger(`Source: ${source.name}  OBS Error (message-id ${error.messageId}) ${error.error}.`, 'error');
            });
        });

        this.obsClient.on('AuthenticationFailure', () => {
            logger(`Source: ${source.name}  Invalid OBS Password.`, 'info');
            this.connected.next(false);
        });

        this.obsClient.on('PreviewSceneChanged', (data) => {
            if(this.isTransitionFinished){
                this.currentPreviewScene = data["scene-name"];
                //We need to execute this only when the transition is finished
                //since preview scene changes during a transition end are processed in 'TransitionEnd' event
                logger(`Source: ${source.name}  Preview Scene Changed.`, 'info-quiet');
                if (data?.sources) {
                    this.removeBusFromAllAddresses("preview");
                    this.processSceneChange(data?.sources, "preview");
                    this.sendTallyData();
                }
            }
        });

        this.obsClient.on('TransitionBegin', (data) => {
            this.isTransitionFinished = false;
            let toScene = this.scenes.find(scene => scene.name === data["to-scene"]);
            if(toScene && data["type"] !== "cut_transition") { //Don't add the transition scene to program bus if it's a cut transition
                this.processSceneChange(toScene.sources, "program");
                this.sendTallyData();
            }

            //Save transition "from-scene" for later use ('TransitionEnd')
            this.currentTransitionFromScene = this.scenes.find(scene => scene.name === data["from-scene"]);
        });

        this.obsClient.on('TransitionEnd', (data) => {
            let scene = this.scenes.find(scene => scene.name === data["to-scene"]);
            this.currentProgramScene = data["to-scene"];
            if (scene?.sources) {
                this.removeBusFromAllAddresses("program");
                this.processSceneChange(scene?.sources, "program");
                logger(`Source: ${source.name}  Program Scene Changed.`, 'info-quiet');

                this.removeBusFromAllAddresses("preview");
                this.processSceneChange(this.currentTransitionFromScene?.sources, "preview"); //'TransitionEnd' has no "from-scene", so use currentTransitionFromScene
                logger(`Source: ${source.name}  Preview Scene Changed.`, 'info-quiet');

                this.sendTallyData();
            }
            this.isTransitionFinished = true;
        });

        this.obsClient.on('SourceMuteStateChanged', (data) => {
            this.processMutedState(data.sourceName, data.muted);
            this.sendTallyData();
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

        this.obsClient.on('SceneItemVisibilityChanged', (data) => {
            this.saveSceneList();
            if(data["item-visible"]) {
                let itemScene = this.scenes.find(scene => scene.name === data["scene-name"]);
                if(itemScene.name === this.currentPreviewScene) {
                    let source = itemScene.sources.find((source) => source.name === data["item-name"]);
                    source.render = true;
                    this.processSceneChange([source], "preview");
                    this.sendTallyData();
                } else if(itemScene.name === this.currentProgramScene) {
                    let source = itemScene.sources.find((source) => source.name === data["item-name"]);
                    source.render = true;
                    this.processSceneChange([source], "program");
                    this.sendTallyData();
                }
            } else {
                this.setBussesForAddress(data["item-name"], []);
                this.sendTallyData();
            }
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

    private processMutedState(sourceName: string, muted: boolean) {
        if(muted) {
            this.setBussesForAddress(sourceName, []);
        } else {
            this.setBussesForAddress(sourceName, ["program"]);
        }
    }

    private processSceneChange(sources: ObsWebSocket4.SceneItem[], bus: string) {
        if (sources) {
            for (const source of sources) {
                if(source.render) {
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

    private initialize_v5(source: Source) {

    }

    public reconnect() {
        this.connect();
    }


    public exit(): void {
        super.exit();
        this.obsClient.disconnect();
    }
}
