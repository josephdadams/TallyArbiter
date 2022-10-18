import { default as ObsWebSocket4 } from 'obs-websocket-js';
import { default as ObsWebSocket5, EventSubscription, OBSResponseTypes } from 'obs-websocket-js-5';
import { logger } from '..';
import { RegisterTallyInput } from "../_decorators/RegisterTallyInput.decorator";
import { Source } from '../_models/Source';
import { TallyInput } from './_Source';

@RegisterTallyInput("4eb73542", "OBS", "The OBS Websocket plugin must be installed on the source.", [
    { fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
    { fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
    { fieldName: 'password', fieldLabel: 'Password', fieldType: 'text', optional: true },
    {
        fieldName: 'version', fieldLabel: 'OBS Websocket plugin version', fieldType: 'dropdown', options: [
            { id: '4', label: 'v4.x.x' },
            { id: '5', label: 'v5.x.x' }
        ]
    }
])
export class OBSSource extends TallyInput {
    private obsProtocolVersion = 4;

    private obsClient4: ObsWebSocket4;
    private scenes4: ObsWebSocket4.Scene[] = [];
    private isTransitionFinished = true;
    private currentTransitionFromScene: ObsWebSocket4.Scene = undefined;
    private currentTransitionToScene: ObsWebSocket4.Scene = undefined;
    private studioModeEnabled: boolean;

    private obsClient5: ObsWebSocket5;
    private scenes5: string[] = [];
    private obsSupportedRpcVersion = 1;

    constructor(source: Source) {
        super(source);

        this.obsProtocolVersion = parseInt(this.source.data.version) || 4;
        if (this.obsProtocolVersion === 4) {
            this.initialize_v4();
        } else if (this.obsProtocolVersion === 5) {
            this.initialize_v5();
        }
    }

    initialize_v4() {
        this.obsClient4 = new ObsWebSocket4();

        this.obsClient4.on('ConnectionClosed', () => {
            this.connected.next(false);
        });

        this.obsClient4.on('AuthenticationSuccess', async () => {
            logger(`Source: ${this.source.name}  OBS Authenticated.`, 'info-quiet');
            this.saveSceneList4();
            this.connected.next(true);

            let sourcesListPromise = this.obsClient4.send('GetSourcesList');
            let sourceTypesListPromise = this.obsClient4.send('GetSourceTypesList');
            Promise.all([sourceTypesListPromise, sourcesListPromise]).then((data) => {
                let [sourceTypesList, sourcesList]: any = data;
                let sourceTypesWithAudio: string[] = [];

                sourceTypesList.types.forEach((type) => {
                    if (type.caps.hasAudio) {
                        sourceTypesWithAudio.push(type.typeId);
                    }
                });

                if (!Array.isArray(sourcesList.sources)) return;
                for (const source of sourcesList.sources) {
                    this.addAddress(source.name, source.name);
                    if (sourceTypesWithAudio.includes(source.typeId)) {
                        this.obsClient4.send('GetMute', {
                            source: source.name
                        }).then((data) => {
                            this.processMutedState(data.name, data.muted);
                            this.sendTallyData();
                        });
                    }
                }
            });

            let previewScenePromise = this.obsClient4.send('GetPreviewScene');
            let programScenePromise = this.obsClient4.send('GetCurrentScene');
            let streamingAndRecordingStatusPromise = this.obsClient4.send('GetStreamingStatus');
            let replayBufferStatusPromise = this.obsClient4.send('GetReplayBufferStatus');
            let studioModePromise = this.obsClient4.send('GetStudioModeStatus');
            Promise.all([
                previewScenePromise, programScenePromise, streamingAndRecordingStatusPromise, replayBufferStatusPromise, studioModePromise
            ]).then((data) => {
                let [previewScene, programScene, streamingAndRecordingStatus, replayBufferStatus, studioModeStatus] = data;

                this.processSceneChange(previewScene.name, previewScene.sources, 'preview');
                this.processSceneChange(programScene.name, programScene.sources, 'program');

                this.studioModeEnabled = studioModeStatus['studio-mode'];

                this.addAddress('{{STREAMING}}', '{{STREAMING}}');
                this.addAddress('{{RECORDING}}', '{{RECORDING}}');
                this.addAddress('{{VIRTUALCAM}}', '{{VIRTUALCAM}}');
                this.addAddress('{{REPLAY}}', '{{REPLAY}}');
                if (streamingAndRecordingStatus.streaming) this.setBussesForAddress("{{STREAMING}}", ["program"]);
                if (streamingAndRecordingStatus.recording) {
                    if (streamingAndRecordingStatus["recording-paused"]) {
                        this.setBussesForAddress("{{RECORDING}}", ["preview"]);
                    } else {
                        this.setBussesForAddress("{{RECORDING}}", ["program"]);
                    }
                }
                if (streamingAndRecordingStatus.virtualcam) this.setBussesForAddress("{{VIRTUALCAM}}", ["program"]);
                if (replayBufferStatus.isReplayBufferActive) this.setBussesForAddress("{{REPLAY}}", ["program"]);

                this.sendTallyData();
            }).catch((error) => {
                console.error(error);
            });
        });

        this.obsClient4.on('AuthenticationFailure', () => {
            logger(`Source: ${this.source.name}  Invalid OBS Password.`, 'info');
            this.connected.next(false);
        });

        this.obsClient4.on('PreviewSceneChanged', (data) => {
            if (this.isTransitionFinished) {
                //We need to execute this only when the transition is finished
                //since preview scene changes during a transition end are processed in 'TransitionEnd' event
                logger(`Source: ${this.source.name}  Preview Scene Changed.`, 'info-quiet');
                if (data?.sources) {
                    this.removeBusFromAllAddresses("preview");
                    this.processSceneChange(data?.['scene-name'], data?.sources, "preview");
                    this.sendTallyData();
                }
            }
        });

        this.obsClient4.on('TransitionBegin', (data) => {
            this.isTransitionFinished = false;
            let toScene = this.scenes4.find(scene => scene.name === data["to-scene"]);
            if (toScene && data["type"] !== "cut_transition") { //Don't add the transition scene to program bus if it's a cut transition
                this.processSceneChange(data?.['to-scene'], toScene.sources, "program");
                this.sendTallyData();
            }

            //Save transition "from-scene" for later use ('TransitionEnd')
            this.currentTransitionFromScene = this.scenes4.find(scene => scene.name === data["from-scene"]);
            //Save transition "to-scene" for later use ('TransitionEnd')
            this.currentTransitionToScene = this.scenes4.find(scene => scene.name === data["to-scene"]);
        });

        this.obsClient4.on('TransitionEnd', (data) => {
            let scene = this.scenes4.find(scene => scene.name === data["to-scene"]);
            if (scene?.sources) {
                this.scenes4.forEach((scene) => {
                    this.setBussesForAddress(scene.name, []);
                    scene.sources.forEach((scene) => {
                        this.setBussesForAddress(scene.name, []);
                    });
                });

                this.processSceneChange(this.currentTransitionToScene['name'], this.currentTransitionToScene?.sources, "program");
                logger(`Source: ${this.source.name}  Program Scene Changed.`, 'info-quiet');

                this.processSceneChange(this.currentTransitionFromScene['name'], this.currentTransitionFromScene?.sources, "preview"); //'TransitionEnd' has no "from-scene", so use currentTransitionFromScene
                logger(`Source: ${this.source.name}  Preview Scene Changed.`, 'info-quiet');

                this.sendTallyData();
            }
            this.isTransitionFinished = true;
        });

        this.obsClient4.on('SourceMuteStateChanged', (data) => {
            this.processMutedState(data.sourceName, data.muted);
            this.sendTallyData();
        });

        this.obsClient4.on("StudioModeSwitched", (data) => {
            this.studioModeEnabled = data['new-state'];
        });

        this.obsClient4.on('SourceCreated', (data) => {
            logger(`Source: ${this.source.name}  New source created`, 'info-quiet');
            this.addAddress(data.sourceName, data.sourceName);
            this.saveSceneList4();
        });

        this.obsClient4.on('SourceDestroyed', (data) => {
            logger(`Source: ${this.source.name} Deleted source: ${data.sourceName}`, 'info-quiet');
            this.removeAddress(data.sourceName);
            this.saveSceneList4();
        });

        this.obsClient4.on('SourceRenamed', (data) => {
            logger(`Source: ${this.source.name}  Source renamed`, 'info-quiet');
            this.renameAddress(data.previousName, data.newName, data.newName);
            this.saveSceneList4();
        });

        this.obsClient4.on("SceneItemVisibilityChanged", (data) => {
            this.scenes4.forEach((scene, sceneIndex) => {
                scene.sources.forEach((source, sourceIndex) => {
                    if (source['name'] === data['item-name'] && scene['name'] == data['scene-name']) {
                        this.scenes4[sceneIndex].sources[sourceIndex]['render'] = data['item-visible'];
                    }
                });
            });
            const parentSceneBusses = this.tally.getValue()[data['scene-name']]; //Yes, I know that doing this is not good with RxJS, but I don't want to update the entire codebase just for this
            console.log(parentSceneBusses);
            if (data['item-visible']) {
                if (parentSceneBusses.includes("program") && !this.studioModeEnabled) {
                    this.addBusToAddress(data['item-name'], "program");
                }
                if (parentSceneBusses.includes("preview")) {
                    this.addBusToAddress(data['item-name'], "preview");
                }
            } else {
                this.removeBusFromAddress(data['item-name'], "preview");
                if (!this.studioModeEnabled) {
                    this.removeBusFromAddress(data['item-name'], "program");
                }
            }
            this.sendTallyData();
        });

        this.obsClient4.on('SceneCollectionChanged', (data) => {
            this.saveSceneList4();
        });

        this.obsClient4.on('StreamStarted', () => {
            this.setBussesForAddress("{{STREAMING}}", ["program"]);
            this.sendTallyData();
        });

        this.obsClient4.on('StreamStopped', () => {
            this.setBussesForAddress("{{STREAMING}}", []);
            this.sendTallyData();
        });

        this.obsClient4.on('RecordingStarted', () => {
            this.setBussesForAddress("{{RECORDING}}", ["program"]);
            this.sendTallyData();
        });

        this.obsClient4.on('RecordingPaused', () => {
            this.setBussesForAddress("{{RECORDING}}", ["preview"]);
            this.sendTallyData();
        });

        this.obsClient4.on('RecordingResumed', () => {
            this.setBussesForAddress("{{RECORDING}}", ["program"]);
            this.sendTallyData();
        });

        this.obsClient4.on('RecordingStopped', () => {
            this.setBussesForAddress("{{RECORDING}}", []);
            this.sendTallyData();
        });

        this.obsClient4.on('VirtualCamStarted', () => {
            this.setBussesForAddress("{{VIRTUALCAM}}", ["program"]);
            this.sendTallyData();
        });

        this.obsClient4.on('VirtualCamStopped', () => {
            this.setBussesForAddress("{{VIRTUALCAM}}", []);
            this.sendTallyData();
        });

        this.obsClient4.on('ReplayStarted', () => {
            this.setBussesForAddress("{{REPLAY}}", ["program"]);
            this.sendTallyData();
        });

        this.obsClient4.on('ReplayStopped', () => {
            this.setBussesForAddress("{{REPLAY}}", []);
            this.sendTallyData();
        });


        this.connect();
    }

    initialize_v5() {
        this.obsClient5 = new ObsWebSocket5();

        this.obsClient5.on('ConnectionClosed', (error) => {
            console.log(error, error.code);
            switch (error.code) {
                case 4009:
                    logger(`Source: ${this.source.name}  OBS Authentication failed`, 'error');
                    this.exit();
                    this.connected.next(false);
                    break;

                case 4010:
                    logger(`Source: ${this.source.name}  OBS Websocket client is uncompatible with this version of TallyArbiter. Please, update TA or fill a bug report.`, 'error');
                    this.exit();
                    this.connected.next(false);
                    break;

                case 4011:
                    logger(`Source: ${this.source.name}  TallyArbiter was kicked out by OBS Websocket clicking on the button in the connections list.`, 'error');
                    this.exit();
                    this.connected.next(false);
                    break;
                
                case 1000:
                    break;

                default:
                    logger(`Source: ${this.source.name}  OBS websocket connection error (error code ${error.code}). Is OBS Websocket version 5 installed?`, 'error');
                    this.exit();
                    this.connected.next(false);
                    break;
            }
        });

        this.obsClient5.on('Identified', () => {
            logger(`Source: ${this.source.name}  OBS Client identified.`, 'info-quiet');
            this.connected.next(true);

            this.obsClient5.callBatch([
                {
                    requestType: 'GetStreamStatus'
                },
                {
                    requestType: 'GetRecordStatus',
                },
                {
                    requestType: 'GetVirtualCamStatus'
                },
                {
                    requestType: 'GetReplayBufferStatus'
                }
            ]).then((results) => {
                this.addAddress('{{STREAMING}}', '{{STREAMING}}');
                this.addAddress('{{RECORDING}}', '{{RECORDING}}');
                this.addAddress('{{VIRTUALCAM}}', '{{VIRTUALCAM}}');
                this.addAddress('{{REPLAY}}', '{{REPLAY}}');

                if((results[0].responseData as OBSResponseTypes['GetStreamStatus']).outputActive) {
                    this.setBussesForAddress("{{STREAMING}}", ["program"]);
                }
                if((results[1].responseData as OBSResponseTypes['GetRecordStatus']).outputActive) {
                    this.setBussesForAddress("{{RECORDING}}", ["program"]);
                } else if((results[1].responseData /*as OBSResponseTypes['GetRecordStatus']*/ as any).outputPaused) { //TODO: update this when typo fixed upstream
                    this.setBussesForAddress("{{RECORDING}}", ["preview"]);
                }
                if((results[2].responseData as OBSResponseTypes['GetVirtualCamStatus']).outputActive) {
                    this.setBussesForAddress("{{VIRTUALCAM}}", ["program"]);
                }
                if(results[3].requestStatus.code === 604 || (results[3].responseData as OBSResponseTypes['GetReplayBufferStatus'])?.outputActive) {
                    this.setBussesForAddress("{{REPLAY}}", ["program"]);
                }
                this.sendTallyData();

                this.saveSceneList5();
            });
        });

        this.obsClient5.on("CurrentPreviewSceneChanged", (data) => {
            this.scenes5.forEach((scene) => {
                if(scene !== data.sceneName) this.removeBusFromAddress(scene, "preview");
            });
            this.setBussesForAddress(data.sceneName, ["preview"]);
            this.sendTallyData();
        });
        
        this.obsClient5.on("CurrentProgramSceneChanged", (data) => {
            this.scenes5.forEach((scene) => {
                if(scene !== data.sceneName) this.removeBusFromAddress(scene, "program");
            });
            this.setBussesForAddress(data.sceneName, ["program"]);
            this.sendTallyData();
        });

        this.obsClient5.on("SceneCreated", (data) => {
            this.saveSceneList5();
        });

        this.obsClient5.on("SceneRemoved", (data) => {
            this.scenes5 = this.scenes5.filter((scene) => scene !== data.sceneName);
            this.removeAddress(data.sceneName);
        });

        this.obsClient5.on("SceneNameChanged", (data) => {
            this.scenes5 = this.scenes5.map((scene) => {
                if (scene === data.oldSceneName) {
                    return data.sceneName;
                }
                return scene;
            });
            this.renameAddress(data.oldSceneName, data.sceneName, data.sceneName);
        });

        this.obsClient5.on("StreamStateChanged", (data) => {
            if (data.outputActive) {
                this.setBussesForAddress("{{STREAMING}}", ["program"]);
            } else {
                this.setBussesForAddress("{{STREAMING}}", []);
            }
            this.sendTallyData();
        });

        this.obsClient5.on("RecordStateChanged", (data) => {
            if (data.outputActive) {
                this.setBussesForAddress("{{RECORDING}}", ["program"]);
            } else {
                this.setBussesForAddress("{{RECORDING}}", []);
            }
            this.sendTallyData();
        });

        this.obsClient5.on("VirtualcamStateChanged", (data) => {
            if (data.outputActive) {
                this.setBussesForAddress("{{VIRTUALCAM}}", ["program"]);
            } else {
                this.setBussesForAddress("{{VIRTUALCAM}}", []);
            }
            this.sendTallyData();
        });

        this.obsClient5.on("ReplayBufferStateChanged", (data) => {
            if (data.outputActive) {
                this.setBussesForAddress("{{REPLAY}}", ["program"]);
            } else {
                this.setBussesForAddress("{{REPLAY}}", []);
            }
            this.sendTallyData();
        });

        this.connect();
    }

    private saveSceneList4() {
        this.obsClient4.send('GetSceneList').then((data) => {
            data.scenes.forEach((scene) => {
                if (!this.scenes4.includes(scene)) {
                    this.addAddress(scene.name, scene.name);
                }
            });
            this.scenes4 = data.scenes;
        });
    }

    private saveSceneList5() {
        this.obsClient5.call('GetSceneList').then((data) => {
            let newScenes = data.scenes.flatMap((scene) => (scene.sceneName as string));
            newScenes.forEach((scene) => {
                if (!this.scenes5.includes(scene)) {
                    this.addAddress(scene, scene);
                }
                if(scene === data.currentPreviewSceneName) {
                    this.setBussesForAddress(scene, ["preview"]);
                }
                if(scene === data.currentProgramSceneName) {
                    this.setBussesForAddress(scene, ["program"]);
                }
                if(scene != data.currentPreviewSceneName && scene != data.currentProgramSceneName) {
                    this.setBussesForAddress(scene, []);
                }
            });
            this.scenes5 = newScenes;
            this.sendTallyData();
        });
    }

    private processMutedState(sourceName: string, muted: boolean) {
        if (muted) {
            this.setBussesForAddress(sourceName, []);
        } else {
            this.setBussesForAddress(sourceName, ["program"]);
        }
    }

    private processSceneChange(sceneName: string, sources: ObsWebSocket4.SceneItem[], bus: string) {
        if (sources) {
            for (const source of sources.filter((s) => s.render)) {
                this.addBusToAddress(source.name, bus);
                if (source.type === "scene") {
                    let nested_scene = this.scenes4.find(scene => scene.name === source.name);
                    if (nested_scene) {
                        this.processSceneChange(nested_scene.name, nested_scene.sources, bus);
                    }
                }
            }
        }
        this.addBusToAddress(sceneName, bus);
    }

    private connect() {
        if (this.obsProtocolVersion === 4) {
            this.obsClient4.connect({
                address: this.source.data.ip + ':' + this.source.data.port,
                password: this.source.data.password
            })
                .catch((error) => {
                    if (error.code === 'CONNECTION_ERROR') {
                        logger(`Source: ${this.source.name}  OBS websocket connection error. Is OBS running?`, 'error');
                        this.connected.next(false);
                    }
                });
        } else if (this.obsProtocolVersion === 5) {
            this.obsClient5.connect(
                `ws://${this.source.data.ip}:${this.source.data.port}`,
                this.source.data.password,
                {
                    rpcVersion: this.obsSupportedRpcVersion,
                    eventSubscriptions: EventSubscription.All //replace this after testing what events we need. Remember: we don't need volume levels, so we don't use all the network bandwidth
                }
            ).catch((error) => {
            });
        }
    }

    public reconnect() {
        this.connect();
    }


    public exit(): void {
        super.exit();
        if (this.obsProtocolVersion === 4) {
            this.obsClient4.disconnect();
        } else if (this.obsProtocolVersion === 5) {
            this.obsClient5.disconnect();
        }
    }
}
