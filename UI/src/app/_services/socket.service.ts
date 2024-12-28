import { Injectable } from '@angular/core'
import { Subject } from 'rxjs'
import { io, Socket } from 'socket.io-client'
import { connLostSnackbarService } from '../_services/conn-lost-snackbar.service'
import { BusOption } from '../_models/BusOption'
import { CloudClient } from '../_models/CloudClient'
import { CloudDestination } from '../_models/CloudDestination'
import { Message } from '../_models/Message'
import { Device } from '../_models/Device'
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

@Injectable({
	providedIn: 'root',
})
export class SocketService {
	public socket: Socket
	public devices: Device[] = []
	public device_states: DeviceState[] = []
	public currentDeviceIdx?: number
	public mode_preview?: boolean
	public mode_program?: boolean
	public listenerClients: ListenerClient[] = []
	public vmixClients: VmixClient[] = []
	public sources: Source[] = []
	public busOptions: BusOption[] = []
	public busOptionsVisible: BusOption[] = []
	public remoteErrorOpt: boolean = true
	public initialDataLoaded = false
	public version?: string
	public uiVersion?: string
	public externalAddress?: string
	public interfaces: any[] = []
	public logs: LogItem[] = []
	public tallyData: LogItem[] = []
	public sourceTypes: SourceType[] = []
	public sourceTypeDataFields: SourceTypeDataFields[] = []
	public testModeOn = false
	public testModeInterval: number = 1000
	public tslclients_1secupdate?: boolean
	public deviceSources: DeviceSource[] = []
	public addresses: Addresses = {}
	public deviceActions: DeviceAction[] = []
	public outputTypes: OutputType[] = []
	public outputTypeDataFields: OutputTypeDataFields[] = []
	public tslClients: TSLClient[] = []
	public cloudDestinations: CloudDestination[] = []
	public cloudKeys: string[] = []
	public cloudClients: CloudClient[] = []
	public portsInUse: Port[] = []
	public networkDiscovery: NetworkDiscovery[] = []
	public messages: Message[] = []
	public errorReports: ErrorReportsListElement[] = [] as ErrorReportsListElement[]
	public users: User[] = []

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

	constructor(private connLostSnackbar: connLostSnackbarService) {
		this.socket = io()

		this.socket.on('error', (message: string) => {
			console.error(message)
		})

		this.socket.on('disconnect', (data) => {
			console.error(data)
			connLostSnackbar.show()
		})
		this.socket.io.on('reconnect_attempt', (attempt) => {
			console.log('Reconnect attempt', attempt)
		})
		this.socket.io.on('reconnect_error', (error) => {
			console.log('Reconnect error:', error.message)
		})

		this.socket.io.on('reconnect', () => {
			console.log('Reconnected successfully')
			this.connLostSnackbar.hide()
			if (typeof this.accessToken !== 'undefined') {
				this.socket.emit('access_token', this.accessToken)
			}
		})

		this.socket.on('sources', (sources: Source[]) => {
			this.sources = this.prepareSources(sources)
		})
		this.socket.on('devices', (devices: Device[]) => {
			this.devices = devices
			this._resolveDataLoadedPromise()
			this.deviceStateChanged.next(this.device_states)
		})
		this.socket.on('bus_options', (busOptions: BusOption[]) => {
			this.busOptions = busOptions
		})
		this.socket.on('listener_clients', (listenerClients: ListenerClient[]) => {
			for (const device of this.devices) {
				device.listenerCount = 0
			}
			this.listenerClients = listenerClients
				.map((l: any) => {
					l.ipAddress = l.ipAddress.replace('::ffff:', '')
					l.device = this.devices.find((d) => d.id == l.deviceId)
					if (!l.inactive) l.device.listenerCount += 1
					return l
				})
				.sort((a: any, b: any) => (a.inactive === b.inactive ? 0 : a.inactive ? 1 : -1))
		})
		this.socket.on('vmix_clients', (vmix_clients: VmixClient[]) => {
			this.vmixClients = vmix_clients.map((l: any) => {
				l.host = l.host.replace('::ffff:', '')
				return l
			})
		})
		this.socket.on('device_states', (device_states: DeviceState[]) => {
			this.device_states = device_states
			this.deviceStateChanged.next(this.device_states)
		})
		this.socket.on('messaging', (type: 'server' | 'client' | 'producer', socketId: string, message: string) => {
			this.messages.push({
				type,
				socketId,
				text: message,
				date: new Date(),
			})
			this.scrollChatSubject.next()
		})
		this.socket.on('version', (version: string) => {
			this.version = version
		})
		this.socket.on('uiVersion', (uiVersion: string) => {
			this.uiVersion = uiVersion
		})

		this.socket.on('externalAddress', (externalAddress: string) => {
			this.externalAddress = externalAddress
		})

		this.socket.on('interfaces', (interfaces: any[]) => {
			interfaces.forEach((net_interface) => {
				this.interfaces.push({
					name: net_interface.name,
					address: net_interface.address,
					url: `http://${net_interface.address}:4455/#/tally`,
				})
			})
		})
		this.socket.on('logs', (logs: LogItem[]) => {
			this.logs = logs
			this.newLogsSubject.next()
		})
		this.socket.on('log_item', (log: LogItem) => {
			if (this.logs.length > 1000) {
				this.logs.shift()
			}
			this.logs.push(log)
			this.newLogsSubject.next()
		})
		this.socket.on('tally_data', (sourceId: string, address: string, busses: string[]) => {
			if (this.tallyData.length > 1000) {
				this.tallyData.shift()
			}

			let deviceSource = this.deviceSources.find((ds) => ds.id === address)
			let deviceId = deviceSource?.deviceId || undefined
			let deviceName = ''
			if (deviceId) {
				let deviceObj = this.devices.find((d) => d.id === deviceId)
				if (deviceObj) {
					deviceName = deviceObj.name
				}
			}

			this.tallyData.push({
				datetime: Date.now().toString(),
				log: `${this.getSourceById(sourceId)?.name}  ${deviceName} ${busses.length === 0 ? 'None' : `Bus${busses.length > 1 ? 'ses' : ''}: ${busses.map((b) => `${b[0].toUpperCase()}${b.slice(1)}`)}`}`,
				type: 'info',
			})
			this.scrollTallyDataSubject.next()
		})
		this.socket.on('device_sources', (deviceSources: DeviceSource[]) => {
			this.deviceSources = deviceSources
		})
		this.socket.on('device_actions', (deviceActions: DeviceAction[]) => {
			this.deviceActions = deviceActions
		})
		this.socket.on('tsl_clients', (clients: TSLClient[]) => {
			this.tslClients = clients
		})
		this.socket.on('cloud_destinations', (destinations: CloudDestination[]) => {
			this.cloudDestinations = destinations
		})
		this.socket.on('cloud_keys', (keys: string[]) => {
			this.cloudKeys = keys
		})
		this.socket.on('cloud_clients', (clients: CloudClient[]) => {
			this.cloudClients = clients
		})
		this.socket.on('addresses', (addresses: Addresses) => {
			this.addresses = addresses
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
				deviceSources: DeviceSource[],
				deviceActions: DeviceAction[],
				device_states: DeviceState[],
				tslClients: TSLClient[],
				cloudDestinations: CloudDestination[],
				cloudKeys: string[],
				cloudClients: CloudClient[],
			) => {
				this.initialDataLoaded = true
				this.sourceTypes = sourceTypes.filter((s: SourceType) => s.enabled)
				this.sourceTypeDataFields = sourceTypesDataFields
				this.addresses = addresses
				this.outputTypes = outputTypes
				this.outputTypeDataFields = outputTypesDataFields
				this.busOptions = busOptions
				this.busOptionsVisible = busOptions.filter((b) => b.visible == true || b.visible == undefined)
				this.sources = this.prepareSources(sourcesData)
				this.devices = devicesData
				this.deviceSources = deviceSources
				this.deviceActions = deviceActions
				this.device_states = device_states
				this.tslClients = tslClients

				this.cloudDestinations = cloudDestinations
				this.cloudKeys = cloudKeys
				this.cloudClients = cloudClients
				this.deviceStateChanged.next(this.device_states)
			},
		)
		this.socket.on('listener_clients', (listenerClients: ListenerClient[]) => {
			this.listenerClients = listenerClients.map((l) => {
				l.ipAddress = l.ipAddress.replace('::ffff:', '')
				return l
			})
		})
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
			this.testModeOn = value
		})
		this.socket.on('tslclients_1secupdate', (value: boolean) => {
			this.tslclients_1secupdate = value
		})
		this.socket.on('PortsInUse', (ports: Port[]) => {
			this.portsInUse = ports
		})
		this.socket.on('networkDiscovery', (networkDiscovery: NetworkDiscovery[]) => {
			networkDiscovery.forEach((nd: NetworkDiscovery) => {
				if (!nd.ip) nd.ip = nd.addresses[0]
			})
			this.networkDiscovery = networkDiscovery
		})
		this.socket.on('error_reports', (errorReports: ErrorReportsListElement[]) => {
			this.errorReports = errorReports
		})
		this.socket.on('users', (users: User[]) => {
			this.users = users
		})

		this.socket.on('remote_error_opt', (optStatus: boolean) => {
			this.remoteErrorOpt = optStatus
		})

		this.socket.emit('get_error_reports')

		this.socket.emit('version')
		this.socket.emit('uiVersion')
		this.socket.emit('externalAddress')
		this.socket.emit('interfaces')
		this.socket.emit('get_error_reports')
	}

	private prepareSources(sources: Source[]): Source[] {
		return sources.map((s) => {
			s.sourceTypeName = this.getSourceTypeById(s.sourceTypeId)?.label
			return s
		})
	}

	private getSourceTypeById(sourceTypeId: string) {
		return this.sourceTypes.find(({ id }: any) => id === sourceTypeId)
	}

	public getSourceById(sourceId: string) {
		return this.sources.find(({ id }) => id === sourceId)
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
		return this.busOptions.find(({ id }) => id === busId)
	}

	private getBusTypeById(busId: string) {
		//gets the bus type (preview/program) by the bus id
		let bus = this.busOptions.find(({ id }: { id: string }) => id === busId)
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
