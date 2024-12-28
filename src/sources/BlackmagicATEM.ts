import { logger } from '..'
import { Atem, listVisibleInputs } from 'atem-connection'
import { RecordingStatus, StreamingStatus } from 'atem-connection/dist/enums'
import { RegisterTallyInput } from '../_decorators/RegisterTallyInput.decorator'
import { RegisterNetworkDiscovery } from '../_decorators/RegisterNetworkDiscovery.decorator'
import { Source } from '../_models/Source'
import { TallyInput } from './_Source'
import { bonjour } from '../_helpers/mdns'

@RegisterNetworkDiscovery((addDiscoveredDevice) => {
	bonjour.find(
		{
			type: 'blackmagic',
			txt: {
				class: 'AtemSwitcher',
			},
		},
		(service) => {
			// ToDo: Remove this if clause once https://github.com/onlxltd/bonjour-service/issues/16 is fixed
			if (service.txt?.class === 'AtemSwitcher') {
				addDiscoveredDevice({
					name: service.name,
					addresses: service.addresses.concat(service.fqdn),
				})
			}
		},
	)
})
@RegisterTallyInput('44b8bc4f', 'Blackmagic ATEM', 'Uses Port 9910.', [
	{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
	{
		fieldName: 'me_onair',
		fieldLabel: 'MEs to monitor',
		fieldType: 'multiselect',
		options: [
			{ id: '1', label: 'ME 1' },
			{ id: '2', label: 'ME 2' },
			{ id: '3', label: 'ME 3' },
			{ id: '4', label: 'ME 4' },
			{ id: '5', label: 'ME 5' },
			{ id: '6', label: 'ME 6' },
		],
		optional: true,
	},
	{
		fieldName: 'cut_bus_mode',
		fieldLabel: 'Bus Mode',
		fieldType: 'dropdown',
		options: [
			{ id: 'off', label: 'Preview / Program Mode' },
			{ id: 'on', label: 'Cut Bus Mode' },
		],
	},
])
export class BlackmagicATEMSource extends TallyInput {
	private atemClient: Atem
	private pgmList = new Set<number | string>()
	private prvList = new Set<number | string>()
	private auxList = new Set<number | string>()

	private oldPgmList = new Set<number | string>()
	private oldPrvList = new Set<number | string>()
	private oldAuxList = new Set<number | string>()

	constructor(source: Source) {
		super(source)

		let atemIP = source.data.ip
		this.atemClient = new Atem()

		this.atemClient.on('connected', () => {
			this.connected.next(true)
			this.processATEMState(this.atemClient.state)
			this.processATEMTally()
			if (this.atemClient.state.recording) {
				this.addAddress('{{RECORDING}}', '{{RECORDING}}')
			}
			if (this.atemClient.state.streaming) {
				this.addAddress('{{STREAMING}}', '{{STREAMING}}')
			}
		})

		this.atemClient.on('disconnected', () => {
			this.connected.next(false)
		})

		this.atemClient.on('stateChanged', (state, paths) => {
			for (const path of paths) {
				if (path.indexOf('video.mixEffects') > -1 || path.indexOf('video.downstreamKeyers') > -1) {
					this.processATEMState(state)
				} else if (path.indexOf('video.auxilliaries') > -1) {
					this.processATEMState(state)
				} else if (path == 'streaming.status') {
					this.processATEMState(state)
				} else if (path == 'recording.status') {
					this.processATEMState(state)
				}
			}
			this.processATEMTally()
		})

		// this.atemClient.on('info', console.log);
		this.atemClient.on('error', console.error)

		this.atemClient.connect(atemIP)
	}

	private processATEMState(state) {
		this.pgmList = new Set()
		this.prvList = new Set()
		this.auxList = new Set()

		// Process video.mixEffects.X.programInput (X: No of MixEffect)
		// video.mixEffects.X.previewInput (X: No of MixEffect)
		for (let i = 0; i < state.video.mixEffects.length; i++) {
			if (this.source.data.me_onair?.includes((i + 1).toString())) {
				listVisibleInputs('program', state, i).forEach((n) => this.pgmList.add(n))
				listVisibleInputs('preview', state, i).forEach((n) => this.prvList.add(n))
			}
		}

		// Process video.auxilliaries.X (X: No of auxBus)
		for (let i = 0; i < state.video.auxilliaries.length; i++) {
			this.auxList.add(state.video.auxilliaries[i])
		}

		switch (this.atemClient.state.streaming?.status?.state) {
			case StreamingStatus.Connecting:
			case StreamingStatus.Stopping:
				this.prvList.add('{{STREAMING}}')
				break
			case StreamingStatus.Streaming:
				this.pgmList.add('{{STREAMING}}')
				break
			default:
				break
		}
		switch (this.atemClient.state.recording?.status?.state) {
			case RecordingStatus.Stopping:
				this.prvList.add('{{RECORDING}}')
				break
			case RecordingStatus.Stopping:
				this.pgmList.add('{{RECORDING}}')
				break
			default:
				break
		}
	}

	private processATEMTally(): void {
		const areSetsEqual = (a, b) => a.size === b.size && [...a].every((value) => b.has(value)) //https://stackoverflow.com/a/44827922
		if (
			areSetsEqual(this.prvList, this.oldPrvList) &&
			areSetsEqual(this.pgmList, this.oldPgmList) &&
			areSetsEqual(this.auxList, this.oldAuxList)
		)
			return

		this.removeBusFromAllAddresses('preview')
		this.removeBusFromAllAddresses('program')
		this.removeBusFromAllAddresses('aux')
		let cutBusMode = this.source.data.cut_bus_mode

		if (cutBusMode === 'on') {
			for (const address of this.prvList) {
				if (this.pgmList.has(address)) {
					this.addBusToAddress(address.toString(), 'program')
				} else {
					this.addBusToAddress(address.toString(), 'preview')
				}
			}
		} else {
			for (const address of this.pgmList) {
				this.addBusToAddress(address.toString(), 'program')
			}
			for (const address of this.prvList) {
				this.addBusToAddress(address.toString(), 'preview')
			}
		}

		// Handle aux independent of Program/Preview mode or Cut Bus mode.
		for (const address of this.auxList) {
			this.addBusToAddress(address.toString(), 'aux')
		}

		this.sendTallyData()

		this.oldPrvList = this.prvList
		this.oldPgmList = this.pgmList
		this.oldAuxList = this.auxList
	}

	public exit(): void {
		super.exit()
		this.atemClient.disconnect()
	}
}
