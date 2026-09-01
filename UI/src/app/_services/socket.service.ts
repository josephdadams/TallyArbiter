import { Injectable, computed, inject, signal } from '@angular/core'
import { Subject } from 'rxjs'
import { io, Socket } from 'socket.io-client'
import { BusOption } from '../_models/BusOption'
import { CloudClient } from '../_models/CloudClient'
import { CloudDestination } from '../_models/CloudDestination'
import { Message } from '../_models/Message'
import { Device } from '../_models/Device'
import { CameraModel } from '../_models/CameraModels'
import { DeviceAction } from '../_models/DeviceAction'
import { DeviceSource } from '../_models/DeviceSource'
import { ListenerClient } from '../_models/ListenerClient'
import { VmixClient } from '../_models/VmixClient'
import { LogItem } from '../_models/LogItem'
import { OutputType } from '../_models/OutputType'
import { OutputTypeDataFields } from '../_models/OutputTypeDataFields'
import { Port } from '../_models/Port'
import { NetworkDiscovery } from '../_models/NetworkDiscovery'
import { Source } from '../_models/Source'
import { TSLTallyData } from '../_models/TSLTallyData'
import { SourceType } from '../_models/SourceType'
import { SourceTypeDataFields } from '../_models/SourceTypeDataFields'
import { TSLClient } from '../_models/TSLClient'
import { ErrorReport } from '../_models/ErrorReport'
import { ErrorReportsListElement } from '../_models/ErrorReportsListElement'
import { DeviceTallyData } from '../_models/TallyData'
import { Addresses } from '../_models/Addresses'
import { DeviceState } from '../_models/DeviceState'
import { User } from '../_models/User'

//the log and tally-data panes are append-only feeds; they are trimmed so a long
//running server doesn't grow an unbounded array behind them
const MAX_LOG_ITEMS = 1000

@Injectable({
	providedIn: 'root',
})
export class SocketService {
	public socket: Socket

	//State the templates render is held in signals: change detection is driven by
	//these being written, not by a zone noticing that a socket callback ran.
	//Anything mutated in place here would be invisible, so every writer replaces
	//the value rather than editing it.
	//Whether the socket is currently up. Every screen that renders live state has
	//to be able to say "this may be stale" — a tally light showing the last colour
	//it heard about is worse than one showing nothing, because it looks correct.
	public readonly connected = signal(true)

	public readonly devices = signal<Device[]>([])
	public readonly cameraModels = signal<CameraModel[]>([])
	public readonly device_states = signal<DeviceState[]>([])
	public readonly currentDeviceIdx = signal<number | undefined>(undefined)
	public readonly mode_preview = signal<boolean | undefined>(undefined)
	public readonly mode_program = signal<boolean | undefined>(undefined)
	public readonly listenerClients = signal<ListenerClient[]>([])
	public readonly vmixClients = signal<VmixClient[]>([])
	public readonly sources = signal<Source[]>([])
	public readonly busOptions = signal<BusOption[]>([])
	public readonly remoteErrorOpt = signal(true)
	public readonly initialDataLoaded = signal(false)
	public readonly version = signal<string | undefined>(undefined)
	public readonly uiVersion = signal<string | undefined>(undefined)
	public readonly externalAddress = signal<string | undefined>(undefined)
	public readonly interfaces = signal<any[]>([])
	public readonly logs = signal<LogItem[]>([])
	public readonly tallyData = signal<LogItem[]>([])
	public readonly sourceTypes = signal<SourceType[]>([])
	public readonly sourceTypeDataFields = signal<SourceTypeDataFields[]>([])
	public readonly testModeOn = signal(false)
	public readonly testModeInterval = signal(1000)
	public readonly tslclients_1secupdate = signal<boolean | undefined>(undefined)
	//server-wide chat switch. optimistic default of true so the chat UI isn't hidden
	//for the moment between page load and the server telling us the real value
	public readonly chatEnabled = signal(true)
	public readonly deviceSources = signal<DeviceSource[]>([])
	public readonly addresses = signal<Addresses>({})
	public readonly deviceActions = signal<DeviceAction[]>([])
	public readonly outputTypes = signal<OutputType[]>([])
	public readonly outputTypeDataFields = signal<OutputTypeDataFields[]>([])
	public readonly tslClients = signal<TSLClient[]>([])
	public readonly cloudDestinations = signal<CloudDestination[]>([])
	public readonly cloudKeys = signal<string[]>([])
	public readonly cloudClients = signal<CloudClient[]>([])
	public readonly portsInUse = signal<Port[]>([])
	public readonly networkDiscovery = signal<NetworkDiscovery[]>([])
	public readonly messages = signal<Message[]>([])
	public readonly errorReports = signal<ErrorReportsListElement[]>([])
	public readonly users = signal<User[]>([])
	//usernames still on the password Tally Arbiter ships with; existing installs are
	//warned rather than locked out, so the settings page nags until this is empty
	public readonly defaultPasswordUsers = signal<string[]>([])

	//Sources the user has switched on that the server cannot currently reach.
	//While one is down, every device fed by it silently keeps its last state.
	public readonly disconnectedSources = computed(() =>
		this.sources().filter((source) => source.enabled && !source.connected),
	)

	//derived rather than assigned: the previous code recomputed this only in the
	//initial-data handler, so a later `bus_options` update left it stale
	public readonly busOptionsVisible = computed(() =>
		this.busOptions().filter((b) => b.visible == true || b.visible == undefined),
	)

	public accessToken: string | undefined

	public dataLoaded = new Promise<void>(async (resolve) => {
		this._resolveDataLoadedPromise = await resolve
	})
	private _resolveDataLoadedPromise!: () => void

	public newLogsSubject = new Subject<void>()
	public scrollTallyDataSubject = new Subject<void>()
	public scrollChatSubject = new Subject<void>()
	public closeModals = new Subject<void>()
	public deviceStateChanged = new Subject<DeviceState[]>()
	public deviceDuplicated = new Subject<void>()

	constructor() {
		this.socket = io()

		this.socket.on('error', (message: string) => {
			console.error(message)
		})

		this.socket.on('connect', () => {
			this.connected.set(true)
		})

		this.socket.on('disconnect', (data) => {
			console.error(data)
			this.connected.set(false)
		})
		this.socket.io.on('reconnect_attempt', (attempt) => {
			console.log('Reconnect attempt', attempt)
		})
		this.socket.io.on('reconnect_error', (error) => {
			console.log('Reconnect error:', error.message)
		})

		this.socket.io.on('reconnect', () => {
			console.log('Reconnected successfully')
			this.connected.set(true)
			if (typeof this.accessToken !== 'undefined') {
				this.socket.emit('access_token', this.accessToken)
			}
		})

		this.socket.on('sources', (sources: Source[]) => {
			this.sources.set(this.prepareSources(sources))
		})
		this.socket.on('devices', (devices: Device[]) => {
			this.devices.set(devices)
			this._resolveDataLoadedPromise()
			this.deviceStateChanged.next(this.device_states())
		})
		this.socket.on('bus_options', (busOptions: BusOption[]) => {
			this.busOptions.set(busOptions)
		})
		this.socket.on('listener_clients', (listenerClients: ListenerClient[]) => {
			//listenerCount lives on the device objects. They are rebuilt rather than
			//counted in place, because mutating them would leave the devices signal
			//unwritten and the producer table's counts frozen.
			const counts = new Map<string, number>()
			for (const l of listenerClients) {
				if (!l.inactive && l.deviceId) {
					counts.set(l.deviceId, (counts.get(l.deviceId) ?? 0) + 1)
				}
			}
			const devices = this.devices().map((d) => ({ ...d, listenerCount: counts.get(d.id) ?? 0 }))
			this.devices.set(devices)

			this.listenerClients.set(
				listenerClients
					.map((l: any) => {
						l.ipAddress = l.ipAddress.replace('::ffff:', '')
						l.device = devices.find((d) => d.id == l.deviceId)
						return l
					})
					.sort((a: any, b: any) => (a.inactive === b.inactive ? 0 : a.inactive ? 1 : -1)),
			)
		})
		this.socket.on('vmix_clients', (vmix_clients: VmixClient[]) => {
			this.vmixClients.set(
				vmix_clients.map((l: any) => {
					l.host = l.host.replace('::ffff:', '')
					return l
				}),
			)
		})
		this.socket.on('device_states', (device_states: DeviceState[]) => {
			this.device_states.set(device_states)
			this.deviceStateChanged.next(device_states)
		})
		this.socket.on('messaging', (type: 'server' | 'client' | 'producer', socketId: string, message: string) => {
			this.messages.update((messages) => [...messages, { type, socketId, text: message, date: new Date() }])
			this.scrollChatSubject.next()
		})
		this.socket.on('version', (version: string) => {
			this.version.set(version)
		})
		this.socket.on('uiVersion', (uiVersion: string) => {
			this.uiVersion.set(uiVersion)
		})

		this.socket.on('externalAddress', (externalAddress: string) => {
			this.externalAddress.set(externalAddress)
		})

		this.socket.on('interfaces', (interfaces: any[]) => {
			this.interfaces.set(
				interfaces.map((net_interface) => ({
					name: net_interface.name,
					address: net_interface.address,
					url: `http://${net_interface.address}:4455/#/tally`,
				})),
			)
		})
		this.socket.on('logs', (logs: LogItem[]) => {
			this.logs.set(logs)
			this.newLogsSubject.next()
		})
		this.socket.on('log_item', (log: LogItem) => {
			this.logs.update((logs) => [...logs, log].slice(-MAX_LOG_ITEMS))
			this.newLogsSubject.next()
		})
		this.socket.on('tally_data', (sourceId: string, address: string, busses: string[]) => {
			let deviceSource = this.deviceSources().find((ds) => ds.id === address)
			let deviceId = deviceSource?.deviceId || undefined
			let deviceName = ''
			if (deviceId) {
				let deviceObj = this.devices().find((d) => d.id === deviceId)
				if (deviceObj) {
					deviceName = deviceObj.name
				}
			}

			const entry: LogItem = {
				datetime: Date.now().toString(),
				log: `${this.getSourceById(sourceId)?.name}  ${deviceName} ${busses.length === 0 ? 'None' : `Bus${busses.length > 1 ? 'ses' : ''}: ${busses.map((b) => `${b[0].toUpperCase()}${b.slice(1)}`)}`}`,
				type: 'info',
			}
			this.tallyData.update((tallyData) => [...tallyData, entry].slice(-MAX_LOG_ITEMS))
			this.scrollTallyDataSubject.next()
		})
		this.socket.on('device_sources', (deviceSources: DeviceSource[]) => {
			this.deviceSources.set(deviceSources)
		})
		this.socket.on('device_actions', (deviceActions: DeviceAction[]) => {
			this.deviceActions.set(deviceActions)
		})
		this.socket.on('tsl_clients', (clients: TSLClient[]) => {
			this.tslClients.set(clients)
		})
		this.socket.on('cloud_destinations', (destinations: CloudDestination[]) => {
			this.cloudDestinations.set(destinations)
		})
		this.socket.on('cloud_keys', (keys: string[]) => {
			this.cloudKeys.set(keys)
		})
		this.socket.on('cloud_clients', (clients: CloudClient[]) => {
			this.cloudClients.set(clients)
		})
		this.socket.on('addresses', (addresses: Addresses) => {
			this.addresses.set(addresses)
		})
		this.socket.on(
			'initialdata',
			(
				sourceTypes: SourceType[],
				sourceTypesDataFields: SourceTypeDataFields[],
				addresses: Addresses,
				outputTypes: OutputType[],
				outputTypesDataFields: OutputTypeDataFields[],
				busOptions: BusOption[],
				sourcesData: Source[],
				devicesData: Device[],
				cameraModels: CameraModel[],
				deviceSources: DeviceSource[],
				deviceActions: DeviceAction[],
				device_states: DeviceState[],
				tslClients: TSLClient[],
				cloudDestinations: CloudDestination[],
				cloudKeys: string[],
				cloudClients: CloudClient[],
			) => {
				this.initialDataLoaded.set(true)
				this.sourceTypes.set(sourceTypes.filter((s: SourceType) => s.enabled))
				this.sourceTypeDataFields.set(sourceTypesDataFields)
				this.addresses.set(addresses)
				this.outputTypes.set(outputTypes)
				this.outputTypeDataFields.set(outputTypesDataFields)
				this.busOptions.set(busOptions)
				this.sources.set(this.prepareSources(sourcesData))
				this.devices.set(devicesData)
				this.cameraModels.set(cameraModels.filter((cm) => cm.visible == true || cm.visible == undefined))
				this.deviceSources.set(deviceSources)
				this.deviceActions.set(deviceActions)
				this.device_states.set(device_states)
				this.tslClients.set(tslClients)

				this.cloudDestinations.set(cloudDestinations)
				this.cloudKeys.set(cloudKeys)
				this.cloudClients.set(cloudClients)
				this.deviceStateChanged.next(this.device_states())
			},
		)
		this.socket.on('manage_response', (response: any) => {
			switch (response.result) {
				case 'source-added-successfully':
				case 'source-edited-successfully':
				case 'source-deleted-successfully':
					this.closeModals.next()
					this.socket.emit('sources')
					this.socket.emit('devices')
					break
				case 'device-added-successfully':
				case 'device-edited-successfully':
				case 'device-deleted-successfully':
					this.closeModals.next()
					this.socket.emit('devices')
					this.socket.emit('device_sources')
					this.socket.emit('device_actions')
					this.socket.emit('device_states')
					this.socket.emit('listener_clients')
					break
				//deliberately not grouped with device-added: duplicating happens from the devices table
				//with no modal open, and the copy is created disabled, which the user needs telling about
				case 'device-duplicated-successfully':
					this.socket.emit('devices')
					this.socket.emit('device_sources')
					this.socket.emit('device_actions')
					this.socket.emit('device_states')
					this.socket.emit('listener_clients')
					this.deviceDuplicated.next()
					break
				case 'device-source-added-successfully':
				case 'device-source-edited-successfully':
					this.socket.emit('device_sources')
					this.closeModals.next()
					break
				case 'device-source-deleted-successfully':
					this.socket.emit('device_sources')
					break
				case 'device-action-added-successfully':
				case 'device-action-edited-successfully':
				case 'device-action-deleted-successfully':
					this.closeModals.next()
					this.socket.emit('devices')
					this.socket.emit('device_actions')
					break
				//no closeModals here: duplicating is done from inside the still-open device actions
				//modal, and closing it would fight the "duplicate, tweak, duplicate again" flow
				case 'device-action-duplicated-successfully':
					this.socket.emit('devices')
					this.socket.emit('device_actions')
					break
				case 'tsl-client-added-successfully':
				case 'tsl-client-edited-successfully':
				case 'tsl-client-deleted-successfully':
					this.closeModals.next()
					this.socket.emit('tsl_clients')
					break
				case 'bus-option-added-successfully':
				case 'bus-option-edited-successfully':
				case 'bus-option-deleted-successfully':
					this.closeModals.next()
					this.socket.emit('bus_options')
					break
				case 'cloud-destination-added-successfully':
				case 'cloud-destination-edited-successfully':
				case 'cloud-destination-deleted-successfully':
					this.closeModals.next()
					this.socket.emit('cloud_destinations')
					break
				case 'cloud-key-added-successfully':
				case 'cloud-key-deleted-successfully':
					this.closeModals.next()
					this.socket.emit('cloud_keys')
					break
				case 'cloud-client-removed-successfully':
					this.closeModals.next()
					this.socket.emit('cloud_clients')
					break
				case 'cloud-client-not-removed':
					alert(response.error)
					this.closeModals.next()
					break
				case 'user-added-successfully':
				case 'user-edited-successfully':
				case 'user-deleted-successfully':
					this.closeModals.next()
					this.socket.emit('users')
					this.socket.emit('default_password_users')
					break
				case 'error':
					alert('Unexpected Error Occurred: ' + response.error)
					break
				default:
					alert(response.result)
					break
			}
		})
		this.socket.on('testmode', (value: boolean) => {
			this.testModeOn.set(value)
		})
		this.socket.on('tslclients_1secupdate', (value: boolean) => {
			this.tslclients_1secupdate.set(value)
		})
		this.socket.on('chat_enabled', (value: boolean) => {
			this.chatEnabled.set(value)
		})
		this.socket.on('PortsInUse', (ports: Port[]) => {
			this.portsInUse.set(ports)
		})
		this.socket.on('networkDiscovery', (networkDiscovery: NetworkDiscovery[]) => {
			networkDiscovery.forEach((nd: NetworkDiscovery) => {
				if (!nd.ip) nd.ip = nd.addresses[0]
			})
			this.networkDiscovery.set(networkDiscovery)
		})
		this.socket.on('error_reports', (errorReports: ErrorReportsListElement[]) => {
			this.errorReports.set(errorReports)
		})
		this.socket.on('users', (users: User[]) => {
			this.users.set(users)
		})
		this.socket.on('default_password_users', (usernames: string[]) => {
			this.defaultPasswordUsers.set(usernames)
		})

		this.socket.on('remote_error_opt', (optStatus: boolean) => {
			this.remoteErrorOpt.set(optStatus)
		})

		this.socket.emit('get_error_reports')

		this.socket.emit('version')
		this.socket.emit('uiVersion')
		this.socket.emit('externalAddress')
		this.socket.emit('interfaces')
	}

	private prepareSources(sources: Source[]): Source[] {
		return sources.map((s) => {
			s.sourceTypeName = this.getSourceTypeById(s.sourceTypeId)?.label
			return s
		})
	}

	private getSourceTypeById(sourceTypeId: string) {
		return this.sourceTypes().find(({ id }: any) => id === sourceTypeId)
	}

	public getSourceById(sourceId: string) {
		return this.sources().find(({ id }) => id === sourceId)
	}

	//Settings the server owns but the UI edits. Signals are not valid two-way
	//binding targets, and doing set-then-emit inline in the template made the
	//local write easy to forget.
	public setChatEnabled(enabled: boolean) {
		this.chatEnabled.set(enabled)
		this.socket.emit('chat_enabled', enabled)
	}

	public setTslClients1SecUpdate(enabled: boolean) {
		this.tslclients_1secupdate.set(enabled)
		this.socket.emit('tslclients_1secupdate', enabled)
	}

	public setTestMode(on: boolean, interval = 1000) {
		if (on) {
			this.socket.emit('testmode', true, interval)
		} else {
			this.socket.emit('testmode', false)
		}
		this.testModeOn.set(on)
	}

	public joinProducers() {
		this.socket.emit('producer')
	}

	public joinAdmins() {
		this.socket.emit('settings')
	}

	public flashListener(listener: any) {
		this.socket.emit('flash', listener.id)
	}

	private getBusById(busId: string) {
		//gets the bus type (preview/program) by the bus id
		return this.busOptions().find(({ id }) => id === busId)
	}

	private getBusTypeById(busId: string) {
		//gets the bus type (preview/program) by the bus id
		let bus = this.busOptions().find(({ id }: { id: string }) => id === busId)
		return bus?.type
	}

	public getErrorReportById(id: string) {
		return new Promise<ErrorReport | boolean>((resolve, reject) => {
			this.socket.emit('get_error_report', id)
			this.socket.once('error_report', (response: any) => {
				if (response !== false) {
					resolve(response)
				} else {
					reject(response)
				}
			})
		})
	}

	public sendAccessToken(accessToken: string) {
		this.accessToken = accessToken
		this.socket.emit('access_token', accessToken)
	}
}
