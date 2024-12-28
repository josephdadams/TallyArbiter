import { default as ObsWebSocket4 } from 'obs-websocket-js'
import { default as ObsWebSocket5, EventSubscription, OBSResponseTypes } from 'obs-websocket-js-5'
import { logger } from '..'
import { RegisterTallyInput } from '../_decorators/RegisterTallyInput.decorator'
import { Source } from '../_models/Source'
import { TallyInput } from './_Source'

@RegisterTallyInput('4eb73542', 'OBS', 'The OBS Websocket plugin must be installed on the source.', [
	{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
	{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
	{ fieldName: 'password', fieldLabel: 'Password', fieldType: 'text', optional: true },
	{
		fieldName: 'version',
		fieldLabel: 'OBS Websocket plugin version',
		fieldType: 'dropdown',
		options: [
			{ id: '4', label: 'v4.x.x' },
			{ id: '5', label: 'v5.x.x' },
		],
	},
])
export class OBSSource extends TallyInput {
	private obsProtocolVersion = 4
	private currentSceneCollectionName = ''
	private audioInputs: string[] = []

	private obsClient4: ObsWebSocket4
	private scenes4: ObsWebSocket4.Scene[] = []
	private isTransitionFinished = true
	private currentTransitionFromScene: ObsWebSocket4.Scene = undefined
	private currentTransitionToScene: ObsWebSocket4.Scene = undefined
	private sourceTypeIdsWithAudio: string[] = []
	private studioModeEnabled: boolean

	private obsClient5: ObsWebSocket5
	private scenes5: string[] = []
	private obsSupportedRpcVersion = 1

	constructor(source: Source) {
		super(source)

		this.obsProtocolVersion = parseInt(this.source.data.version) || 4
		if (this.obsProtocolVersion === 4) {
			this.initialize_v4()
		} else if (this.obsProtocolVersion === 5) {
			this.initialize_v5()
		}
	}

	/** Initializes the OBS WebSocket4 Client and registers event listeners */
	private initialize_v4(): void {
		this.obsClient4 = new ObsWebSocket4()

		this.obsClient4.on('ConnectionClosed', () => {
			this.connected.next(false)
		})

		this.obsClient4.on('AuthenticationSuccess', async () => {
			logger(`Source: ${this.source.name}  OBS Authenticated.`, 'info-quiet')
			this.saveSceneList4()
			this.connected.next(true)

			let sourcesListPromise = this.obsClient4.send('GetSourcesList')
			let sourceTypesListPromise = this.obsClient4.send('GetSourceTypesList')
			Promise.all([sourceTypesListPromise, sourcesListPromise]).then((data) => {
				let [sourceTypesList, sourcesList]: any = data

				sourceTypesList.types.forEach((type) => {
					if (type.caps.hasAudio) {
						this.sourceTypeIdsWithAudio.push(type.typeId)
					}
				})

				if (!Array.isArray(sourcesList.sources)) return
				for (const source of sourcesList.sources) {
					this.addAudioInput(source)
				}
			})

			let previewScenePromise = this.obsClient4.send('GetPreviewScene')
			let programScenePromise = this.obsClient4.send('GetCurrentScene')
			let streamingAndRecordingStatusPromise = this.obsClient4.send('GetStreamingStatus')
			let replayBufferStatusPromise = this.obsClient4.send('GetReplayBufferStatus')
			let sceneCollectionPromise = this.obsClient4.send('GetCurrentSceneCollection')
			let studioModePromise = this.obsClient4.send('GetStudioModeStatus')
			Promise.all([
				previewScenePromise,
				programScenePromise,
				streamingAndRecordingStatusPromise,
				replayBufferStatusPromise,
				sceneCollectionPromise,
				studioModePromise,
			])
				.then((data) => {
					let [
						previewScene,
						programScene,
						streamingAndRecordingStatus,
						replayBufferStatus,
						sceneCollection,
						studioModeStatus,
					] = data

					this.processSceneChange4(previewScene.name, previewScene.sources, 'preview')
					this.processSceneChange4(programScene.name, programScene.sources, 'program')

					this.currentSceneCollectionName = sceneCollection['sc-name']

					this.studioModeEnabled = studioModeStatus['studio-mode']

					this.addAddress('{{STREAMING}}', '{{STREAMING}}')
					this.addAddress('{{RECORDING}}', '{{RECORDING}}')
					this.addAddress('{{VIRTUALCAM}}', '{{VIRTUALCAM}}')
					this.addAddress('{{REPLAY}}', '{{REPLAY}}')
					if (streamingAndRecordingStatus.streaming) this.setBussesForAddress('{{STREAMING}}', ['program'])
					if (streamingAndRecordingStatus.recording) {
						if (streamingAndRecordingStatus['recording-paused']) {
							this.setBussesForAddress('{{RECORDING}}', ['preview'])
						} else {
							this.setBussesForAddress('{{RECORDING}}', ['program'])
						}
					}
					if (streamingAndRecordingStatus.virtualcam) this.setBussesForAddress('{{VIRTUALCAM}}', ['program'])
					if (replayBufferStatus.isReplayBufferActive) this.setBussesForAddress('{{REPLAY}}', ['program'])

					this.sendTallyData()
				})
				.catch((error) => {
					console.error(error)
				})
		})

		this.obsClient4.on('AuthenticationFailure', () => {
			logger(`Source: ${this.source.name}  Invalid OBS Password.`, 'info')
			this.connected.next(false)
		})

		this.obsClient4.on('PreviewSceneChanged', (data) => {
			if (this.isTransitionFinished) {
				//We need to execute this only when the transition is finished
				//since preview scene changes during a transition end are processed in 'TransitionEnd' event
				if (data?.sources) {
					this.removeBusFromAllAddresses('preview')
					this.processSceneChange4(data?.['scene-name'], data?.sources, 'preview')
					this.sendTallyData()
				}
			}
		})

		this.obsClient4.on('TransitionBegin', (data) => {
			this.isTransitionFinished = false
			let toScene = this.scenes4.find((scene) => scene.name === data['to-scene'])
			if (toScene && data['type'] !== 'cut_transition') {
				//Don't add the transition scene to program bus if it's a cut transition
				this.processSceneChange4(data?.['to-scene'], toScene.sources, 'program')
				this.sendTallyData()
			}

			//Save transition "from-scene" for later use ('TransitionEnd')
			this.currentTransitionFromScene = this.scenes4.find((scene) => scene.name === data['from-scene'])
			//Save transition "to-scene" for later use ('TransitionEnd')
			this.currentTransitionToScene = this.scenes4.find((scene) => scene.name === data['to-scene'])
		})

		this.obsClient4.on('TransitionEnd', (data) => {
			let scene = this.scenes4.find((scene) => scene.name === data['to-scene'])
			if (scene?.sources) {
				this.scenes4.forEach((scene) => {
					this.setBussesForAddress(scene.name, [])
					scene.sources.forEach((scene) => {
						this.setBussesForAddress(scene.name, [])
					})
				})

				this.processSceneChange4(
					this.currentTransitionToScene['name'],
					this.currentTransitionToScene?.sources,
					'program',
				)
				this.processSceneChange4(
					this.currentTransitionFromScene['name'],
					this.currentTransitionFromScene?.sources,
					'preview',
				) //'TransitionEnd' has no "from-scene", so use currentTransitionFromScene

				this.sendTallyData()
			}
			this.isTransitionFinished = true
		})

		this.obsClient4.on('SourceMuteStateChanged', (data) => {
			this.setBussesForAddress(data.sourceName, data.muted ? [] : ['program'])
			this.sendTallyData()
		})

		this.obsClient4.on('StudioModeSwitched', (data) => {
			logger(`Source: ${this.source.name}  Studio mode ${data['new-state'] ? 'enabled' : 'disabled'}`, 'error')
			this.studioModeEnabled = data['new-state']
		})

		this.obsClient4.on('SourceCreated', (data) => {
			logger(`Source: ${this.source.name}  New source created (${data.sourceName})`, 'info-quiet')
			if (data.sourceType === 'input' && this.sourceTypeIdsWithAudio.includes(data.sourceKind)) {
				this.addAudioInput({
					name: data.sourceName,
					typeId: data.sourceKind,
				})
			} else {
				this.addAddress(data.sourceName, data.sourceName)
			}
			this.obsClient4.send('GetSceneList').then((scenesList) => {
				scenesList.scenes.forEach((scene, sceneIndex) => {
					scene.sources.forEach((source) => {
						if (source.name === data.sourceName && this.scenes4[sceneIndex]) {
							this.scenes4[sceneIndex].sources.push(source)
						}
					})
				})
			})
		})

		this.obsClient4.on('SourceDestroyed', (data) => {
			logger(`Source: ${this.source.name}  Deleted source: ${data.sourceName}`, 'info-quiet')
			if (this.audioInputs.find((input) => input === data.sourceName)) {
				this.audioInputs = this.audioInputs.filter((input) => input !== data.sourceName)
			}
			this.scenes4.forEach((source, index) => {
				this.scenes4[index].sources = this.scenes4[index].sources.filter((source) => source.name !== data.sourceName)
			})
			this.removeAddress(data.sourceName)
		})

		this.obsClient4.on('SourceRenamed', (data) => {
			logger(`Source: ${this.source.name}  Source ${data.previousName} renamed in ${data.newName}`, 'info-quiet')
			if (this.audioInputs.find((input) => input === data.previousName)) {
				this.audioInputs = this.audioInputs.map((input) => {
					if (input === data.previousName) {
						return data.newName
					}
					return input
				})
			}
			this.scenes4.forEach((source, index) => {
				this.scenes4[index].sources = this.scenes4[index].sources.map((source) => {
					if (source.name === data.previousName) {
						return { ...source, name: data.newName }
					}
					return source
				})
			})
			this.renameAddress(data.previousName, data.newName, data.newName)
		})

		this.obsClient4.on('SceneItemVisibilityChanged', (data) => {
			this.scenes4.forEach((scene, sceneIndex) => {
				scene.sources.forEach((source, sourceIndex) => {
					if (source['name'] === data['item-name'] && scene['name'] == data['scene-name']) {
						this.scenes4[sceneIndex].sources[sourceIndex]['render'] = data['item-visible']
					}
				})
			})
			const parentSceneBusses = this.tally.getValue()[data['scene-name']] //Yes, I know that doing this is not good with RxJS, but I don't want to update the entire codebase just for this
			if (data['item-visible']) {
				if (parentSceneBusses.includes('program') && !this.studioModeEnabled) {
					this.addBusToAddress(data['item-name'], 'program')
				}
				if (parentSceneBusses.includes('preview')) {
					this.addBusToAddress(data['item-name'], 'preview')
				}
			} else {
				this.removeBusFromAddress(data['item-name'], 'preview')
				if (!this.studioModeEnabled) {
					this.removeBusFromAddress(data['item-name'], 'program')
				}
			}
			this.sendTallyData()
		})

		this.obsClient4.on('SceneCollectionChanged', (data) => {
			if (this.currentSceneCollectionName !== data.sceneCollection) {
				logger(`Source: ${this.source.name}  Scene collection changed to ${data.sceneCollection}`, 'info-quiet')
				this.scenes4.forEach((scene) => {
					this.removeAddress(scene.name)
				})
				this.saveSceneList4()
			}
		})

		this.obsClient4.on('StreamStarted', () => {
			logger(`Source: ${this.source.name}  Streaming started`, 'info-quiet')
			this.setBussesForAddress('{{STREAMING}}', ['program'])
			this.sendTallyData()
		})

		this.obsClient4.on('StreamStopped', () => {
			logger(`Source: ${this.source.name}  Streaming stopped`, 'info-quiet')
			this.setBussesForAddress('{{STREAMING}}', [])
			this.sendTallyData()
		})

		this.obsClient4.on('RecordingStarted', () => {
			logger(`Source: ${this.source.name}  Recording started`, 'info-quiet')
			this.setBussesForAddress('{{RECORDING}}', ['program'])
			this.sendTallyData()
		})

		this.obsClient4.on('RecordingPaused', () => {
			logger(`Source: ${this.source.name}  Recording paused`, 'info-quiet')
			this.setBussesForAddress('{{RECORDING}}', ['preview'])
			this.sendTallyData()
		})

		this.obsClient4.on('RecordingResumed', () => {
			logger(`Source: ${this.source.name}  Recording resumed`, 'info-quiet')
			this.setBussesForAddress('{{RECORDING}}', ['program'])
			this.sendTallyData()
		})

		this.obsClient4.on('RecordingStopped', () => {
			logger(`Source: ${this.source.name}  Recording stopped`, 'info-quiet')
			this.setBussesForAddress('{{RECORDING}}', [])
			this.sendTallyData()
		})

		this.obsClient4.on('VirtualCamStarted', () => {
			logger(`Source: ${this.source.name}  VirtualCam started`, 'info-quiet')
			this.setBussesForAddress('{{VIRTUALCAM}}', ['program'])
			this.sendTallyData()
		})

		this.obsClient4.on('VirtualCamStopped', () => {
			logger(`Source: ${this.source.name}  VirtualCam stopped`, 'info-quiet')
			this.setBussesForAddress('{{VIRTUALCAM}}', [])
			this.sendTallyData()
		})

		this.obsClient4.on('ReplayStarted', () => {
			logger(`Source: ${this.source.name}  Replay Buffer started`, 'info-quiet')
			this.setBussesForAddress('{{REPLAY}}', ['program'])
			this.sendTallyData()
		})

		this.obsClient4.on('ReplayStopped', () => {
			logger(`Source: ${this.source.name}  Replay Buffer stopped`, 'info-quiet')
			this.setBussesForAddress('{{REPLAY}}', [])
			this.sendTallyData()
		})

		this.connect()
	}

	/** Initializes the OBS WebSocket5 Client and registers event listeners */
	private initialize_v5(): void {
		this.obsClient5 = new ObsWebSocket5()

		this.obsClient5.on('ConnectionClosed', (error) => {
			switch (error.code) {
				case 4009:
					logger(`Source: ${this.source.name}  OBS Authentication failed`, 'error')
					this.exit()
					this.connected.next(false)
					break

				case 4010:
					logger(
						`Source: ${this.source.name}  OBS Websocket client is incompatible with this version of TallyArbiter. Please, update TA or fill a bug report.`,
						'error',
					)
					this.exit()
					this.connected.next(false)
					break

				case 4011:
					logger(
						`Source: ${this.source.name}  TallyArbiter was kicked out by OBS Websocket clicking on the button in the connections list.`,
						'error',
					)
					this.exit()
					this.connected.next(false)
					break

				case 1000:
					break

				default:
					logger(
						`Source: ${this.source.name}  OBS websocket connection error (error code ${error.code}). Is OBS Websocket version 5 installed?`,
						'error',
					)
					this.exit()
					this.connected.next(false)
					break
			}
		})

		this.obsClient5.on('Identified', () => {
			logger(`Source: ${this.source.name}  OBS Client identified.`, 'info-quiet')
			this.connected.next(true)

			this.obsClient5
				.callBatch([
					{
						requestType: 'GetStreamStatus',
					},
					{
						requestType: 'GetRecordStatus',
					},
					{
						requestType: 'GetVirtualCamStatus',
					},
					{
						requestType: 'GetReplayBufferStatus',
					},
					{
						requestType: 'GetSceneCollectionList',
					},
					{
						requestType: 'GetInputList',
						requestData: {},
					},
				])
				.then((results) => {
					this.addAddress('{{STREAMING}}', '{{STREAMING}}')
					this.addAddress('{{RECORDING}}', '{{RECORDING}}')
					this.addAddress('{{VIRTUALCAM}}', '{{VIRTUALCAM}}')
					this.addAddress('{{REPLAY}}', '{{REPLAY}}')

					if ((results[0].responseData as OBSResponseTypes['GetStreamStatus']).outputActive) {
						this.setBussesForAddress('{{STREAMING}}', ['program'])
					}
					if ((results[1].responseData as OBSResponseTypes['GetRecordStatus']).outputActive) {
						this.setBussesForAddress('{{RECORDING}}', ['program'])
					} else if ((results[1].responseData /*as OBSResponseTypes['GetRecordStatus']*/ as any)?.outputPaused) {
						//TODO: update this when typo fixed upstream
						this.setBussesForAddress('{{RECORDING}}', ['preview'])
					}
					if ((results[2].responseData as OBSResponseTypes['GetVirtualCamStatus']).outputActive) {
						this.setBussesForAddress('{{VIRTUALCAM}}', ['program'])
					}
					if (
						results[3].requestStatus.code === 604 ||
						(results[3].responseData as OBSResponseTypes['GetReplayBufferStatus'])?.outputActive
					) {
						this.setBussesForAddress('{{REPLAY}}', ['program'])
					}
					this.sendTallyData()

					this.currentSceneCollectionName = (
						results[4].responseData as OBSResponseTypes['GetSceneCollectionList']
					).currentSceneCollectionName

					//Thanks mooff for the workaround https://discord.com/channels/715691013825364120/853448696061755470/1021847398072455288
					const inputs = (results[5].responseData as OBSResponseTypes['GetInputList']).inputs
					Promise.allSettled(
						inputs.map(({ inputName }) => this.obsClient5.call('GetInputVolume', { inputName: inputName as string })),
					).then((hasAudioChecks) => {
						this.audioInputs = inputs
							.filter((_, i) => hasAudioChecks[i].status == 'fulfilled')
							.map((input) => {
								return input.inputName as string
							})

						this.audioInputs.forEach((input) => {
							this.addAudioInput(input)
						})
					})

					this.saveSceneList5()
				})
		})

		this.obsClient5.on('CurrentPreviewSceneChanged', (data) => {
			this.removeBusFromAllAddresses('preview')
			this.addBusToAddress(data.sceneName, 'preview')
			this.processSceneChange5(data.sceneName, 'preview')

			//this.sendTallyData();
		})

		this.obsClient5.on('CurrentProgramSceneChanged', (data) => {
			this.removeBusFromAllAddresses('program')
			this.addBusToAddress(data.sceneName, 'program')
			this.processSceneChange5(data.sceneName, 'program')

			// this.sendTallyData();
		})

		this.obsClient5.on('CurrentSceneCollectionChanged', (data) => {
			if (this.currentSceneCollectionName !== data.sceneCollectionName) {
				logger(`Source: ${this.source.name}  Scene collection changed to ${data.sceneCollectionName}`, 'info-quiet')
				this.scenes5.forEach((scene) => {
					this.removeAddress(scene)
				})
				this.saveSceneList5()
			}
		})

		this.obsClient5.on('SceneCreated', (data) => {
			if (data.isGroup) return
			logger(`Source: ${this.source.name}  New source created (${data.sceneName})`, 'info-quiet')
			this.saveSceneList5()
		})

		this.obsClient5.on('SceneRemoved', (data) => {
			if (data.isGroup) return
			logger(`Source: ${this.source.name}  Deleted source: ${data.sceneName}`, 'info-quiet')
			this.scenes5 = this.scenes5.filter((scene) => scene !== data.sceneName)
			this.removeAddress(data.sceneName)
		})

		this.obsClient5.on('SceneNameChanged', (data) => {
			logger(`Source: ${this.source.name}  Source ${data.oldSceneName} renamed in ${data.sceneName}`, 'info-quiet')
			this.scenes5 = this.scenes5.map((scene) => {
				if (scene === data.oldSceneName) {
					return data.sceneName
				}
				return scene
			})
			this.obsClient5.call('GetGroupList').then((groupList) => {
				let isGroup = false
				groupList.groups.forEach((group) => {
					if (data.sceneName === group) isGroup = true
				})
				if (!isGroup) this.renameAddress(data.oldSceneName, data.sceneName, data.sceneName)
			})
		})

		this.obsClient5.on('InputCreated', (data) => {
			this.obsClient5
				.call('GetInputVolume', { inputName: data.inputName })
				.then((response) => {
					this.addAudioInput(data.inputName)
				})
				.catch((err) => {})
		})

		this.obsClient5.on('InputRemoved', (data) => {
			if (this.audioInputs.includes(data.inputName)) {
				logger(`Source: ${this.source.name}  Removed audio input ${data.inputName}`, 'info-quiet')
				this.audioInputs = this.audioInputs.filter((input) => input !== data.inputName)
				this.removeAddress(data.inputName)
			}
		})

		this.obsClient5.on('InputNameChanged', (data) => {
			if (this.audioInputs.includes(data.oldInputName)) {
				logger(
					`Source: ${this.source.name}  Audio input ${data.oldInputName} renamed in ${data.inputName}`,
					'info-quiet',
				)
				this.audioInputs = this.audioInputs.map((input) => {
					if (input === data.oldInputName) {
						return data.inputName
					}
					return input
				})
				this.renameAddress(data.oldInputName, data.inputName, data.inputName)
			}
		})

		this.obsClient5.on('InputMuteStateChanged', (data) => {
			if (!this.audioInputs.includes(data.inputName)) return
			if (data.inputMuted) {
				this.setBussesForAddress(data.inputName, [])
			} else {
				this.setBussesForAddress(data.inputName, ['program'])
			}
			this.sendTallyData()
		})

		this.obsClient5.on('StreamStateChanged', (data) => {
			logger(`Source: ${this.source.name}  Streaming ${data.outputActive ? 'started' : 'stopped'}`, 'info-quiet')
			if (data.outputActive) {
				this.setBussesForAddress('{{STREAMING}}', ['program'])
			} else {
				this.setBussesForAddress('{{STREAMING}}', [])
			}
			this.sendTallyData()
		})

		this.obsClient5.on('RecordStateChanged', (data) => {
			logger(
				`Source: ${this.source.name}  Recording ${data.outputActive ? 'started' : (data as any).outputPaused ? 'paused' : 'stopped'}`,
				'info-quiet',
			) //TODO: update this when typo fixed upstream
			if (data.outputActive) {
				this.setBussesForAddress('{{RECORDING}}', ['program'])
			} else if ((data as any)?.outputPaused) {
				//TODO: update this when typo fixed upstream
				this.setBussesForAddress('{{RECORDING}}', ['preview'])
			} else {
				this.setBussesForAddress('{{RECORDING}}', [])
			}
			this.sendTallyData()
		})

		this.obsClient5.on('VirtualcamStateChanged', (data) => {
			logger(`Source: ${this.source.name}  VirtualCam ${data.outputActive ? 'started' : 'stopped'}`, 'info-quiet')
			if (data.outputActive) {
				this.setBussesForAddress('{{VIRTUALCAM}}', ['program'])
			} else {
				this.setBussesForAddress('{{VIRTUALCAM}}', [])
			}
			this.sendTallyData()
		})

		this.obsClient5.on('ReplayBufferStateChanged', (data) => {
			logger(`Source: ${this.source.name}  Replay Buffer ${data.outputActive ? 'started' : 'stopped'}`, 'info-quiet')
			if (data.outputActive) {
				this.setBussesForAddress('{{REPLAY}}', ['program'])
			} else {
				this.setBussesForAddress('{{REPLAY}}', [])
			}
			this.sendTallyData()
		})

		this.connect()
	}

	/** Gets the Scene List, updates this.scenes4 and adds address if scene is not registered. */
	private saveSceneList4(): void {
		this.obsClient4.send('GetSceneList').then((data) => {
			data.scenes.forEach((scene) => {
				if (!this.scenes4.includes(scene)) {
					this.addAddress(scene.name, scene.name)
				}
			})
			this.scenes4 = data.scenes
		})
	}

	/** Gets the Scene List, updates this.scenes5 and adds address if scene is not registered.
	 * This function is also used to update the busses at every preview/program change since there aren't events for transitions.
	 */
	private saveSceneList5(): void {
		this.obsClient5.call('GetSceneList').then((data) => {
			let newScenes = data.scenes.flatMap((scene) => scene.sceneName as string)
			newScenes.forEach((scene) => {
				if (!this.scenes5.includes(scene)) {
					this.addAddress(scene, scene)
				}
				if (scene === data.currentPreviewSceneName) {
					this.setBussesForAddress(scene, ['preview'])
					this.processSceneChange5(scene, 'preview')
				}
				if (scene === data.currentProgramSceneName) {
					this.setBussesForAddress(scene, ['program'])
					this.processSceneChange5(scene, 'program')
				}
				if (scene != data.currentPreviewSceneName && scene != data.currentProgramSceneName) {
					this.setBussesForAddress(scene, [])
				}
			})
			this.scenes5 = newScenes
			this.sendTallyData()
		})
	}

	/** Adds a bus to the scene, nested scenes and scene sources.
	 * @param sceneName - Name of the scene.
	 * @param sources - List of scene sources (SceneItem).
	 * @param bus - Bus to assign (preview/program).
	 */
	private processSceneChange4(sceneName: string, sources: ObsWebSocket4.SceneItem[], bus: string): void {
		if (sources) {
			for (const source of sources.filter((s) => s.render)) {
				this.addBusToAddress(source.name, bus)
				if (source.type === 'scene') {
					let nested_scene = this.scenes4.find((scene) => scene.name === source.name)
					if (nested_scene) {
						this.processSceneChange4(nested_scene.name, nested_scene.sources, bus)
					}
				}
			}
		}
		this.addBusToAddress(sceneName, bus)
	}

	/** Adds a bus for the scene, nested scenes and scene sources.
	 * @param sceneName - Name of the scene.
	 * @param bus - Bus to assign (preview/program).
	 */
	private processSceneChange5(sceneName: string, bus: string): void {
		// No support for specific handling for Groups since Group usage is discouraged in OBS, see https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md#getsceneitemlist
		this.obsClient5.call('GetSceneItemList', { sceneName: sceneName }).then((sceneItems) => {
			let sceneSources = 0
			for (let i = 0; i < sceneItems.sceneItems.length; i++) {
				// All scene source items to the bus
				// Should a check be done for audio input if they are enabled?
				this.addBusToAddress(sceneItems.sceneItems[i].sourceName as string, bus)
				if (sceneItems.sceneItems[i].sourceType == 'OBS_SOURCE_TYPE_INPUT') {
					sceneSources++
				} else if (sceneItems.sceneItems[i].sourceType == 'OBS_SOURCE_TYPE_SCENE') {
					// Nested scene, dig deeper...
					this.processSceneChange5(sceneItems.sceneItems[i].sourceName as string, bus)
				}
			}

			// If this scene doesn't contain a scene then we trigger this.sendTallyData().
			// The check is done to keep uncessary updates to a minimum.
			if (sceneSources == sceneItems.sceneItems.length) {
				this.sendTallyData()
			}
		})
	}

	/** Adds audio input to addresses, to the "audioInputs" list and change tally bus if it's not muted. */
	private addAudioInput(input): void {
		if (this.obsProtocolVersion === 4) {
			if (!this.audioInputs.includes(input.name) && this.sourceTypeIdsWithAudio.includes(input.typeId)) {
				this.audioInputs.push(input.name)
				this.addAddress(input.name, input.name)
				this.obsClient4
					.send('GetMute', {
						source: input.name,
					})
					.then((data) => {
						this.setBussesForAddress(data.name, data.muted ? [] : ['program'])
						this.sendTallyData()
					})
			}
		} else if (this.obsProtocolVersion === 5) {
			logger(`Source: ${this.source.name}  New audio input created (${input})`, 'info-quiet')
			this.addAddress(input, input)
			if (!this.audioInputs.includes(input)) this.audioInputs.push(input)
			this.obsClient5
				.call('GetInputMute', {
					inputName: input,
				})
				.then((data) => {
					this.setBussesForAddress(input, data.inputMuted ? [] : ['program'])
					this.sendTallyData()
				})
		}
	}

	/** Connects to OBS after listeners have been set. */
	private connect(): void {
		if (this.obsProtocolVersion === 4) {
			this.obsClient4
				.connect({
					address: this.source.data.ip + ':' + this.source.data.port,
					password: this.source.data.password,
				})
				.catch((error) => {
					logger(`Source: ${this.source.name}  OBS websocket Error occurred: ${error.code}`, 'error')
				})
		} else if (this.obsProtocolVersion === 5) {
			this.obsClient5
				.connect(`ws://${this.source.data.ip}:${this.source.data.port}`, this.source.data.password, {
					rpcVersion: this.obsSupportedRpcVersion,
					//TODO: replace this after testing what events we need. Remember: we don't need volume levels, so we don't use all the network bandwidth
					/* eventSubscriptions: EventSubscription.All */
				})
				.catch((error) => {})
		}
	}

	public reconnect(): void {
		this.connect()
	}

	public exit(): void {
		super.exit()
		if (this.obsProtocolVersion === 4) {
			this.obsClient4.disconnect()
		} else if (this.obsProtocolVersion === 5) {
			this.obsClient5.disconnect()
		}
	}
}
