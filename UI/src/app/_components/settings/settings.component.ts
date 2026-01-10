import { Component, ElementRef, ViewChild } from '@angular/core'
import { Router } from '@angular/router'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { Confirmable } from 'src/app/_decorators/confirmable.decorator'
import { CloudClient } from 'src/app/_models/CloudClient'
import { CloudDestination } from 'src/app/_models/CloudDestination'
import { NetworkDiscovery } from 'src/app/_models/NetworkDiscovery'
import { Device } from 'src/app/_models/Device'
import { DeviceAction } from 'src/app/_models/DeviceAction'
import { DeviceSource } from 'src/app/_models/DeviceSource'
import { ListenerClient } from 'src/app/_models/ListenerClient'
import { LogItem } from 'src/app/_models/LogItem'
import { OutputType } from 'src/app/_models/OutputType'
import { Source } from 'src/app/_models/Source'
import { SourceType } from 'src/app/_models/SourceType'
import { TSLClient } from 'src/app/_models/TSLClient'
import { SocketService } from 'src/app/_services/socket.service'
import Swal from 'sweetalert2'
import { SweetAlertOptions } from 'sweetalert2'
import { BusOption } from 'src/app/_models/BusOption'
import { SourceTypeBus } from 'src/app/_models/SourceTypeBus'
import { User } from 'src/app/_models/User'
import { AuthService } from 'src/app/_services/auth.service'
import { JsonEditorComponent, JsonEditorOptions } from 'ang-jsoneditor'
import { default as configSchema } from '../../../../../src/_helpers/configSchema'

const globalSwalOptions = {
	confirmButtonColor: '#2a70c7',
}

const remoteErrorText: string = 'Remote error reporting helps us keep Tally Arbiter running smoothly.'

const optOutAlertOptions: SweetAlertOptions = {
	title: 'Are you sure?',
	text: remoteErrorText,
	showCancelButton: true,
	confirmButtonColor: '#2a70c7',
	icon: 'question',
	focusCancel: false,
}

const optInAlertOptions: SweetAlertOptions = {
	title: 'Thank you!',
	text: remoteErrorText,
	showCancelButton: false,
	confirmButtonColor: '#2a70c7',
	icon: 'success',
	focusCancel: false,
}

type LogLevel = { title: string; id: string }

@Component({
	selector: 'app-settings',
	templateUrl: './settings.component.html',
	styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent {
	@ViewChild('logsContainer') private logsContainer!: ElementRef
	@ViewChild('tallyDataContainer') private tallyDataContainer!: ElementRef

	public logLevels: LogLevel[] = [
		{ title: 'Error', id: 'error' },
		{ title: 'Console', id: 'console-action' },
		{ title: 'Info', id: 'info' },
		{ title: 'Verbose', id: 'info-quiet' },
	]
	public currentLogLevel = 'info'
	public visibleLogs: LogItem[] = []
	public deviceBusColors: Record<string, string[]> = {}

	// add / edit Source
	public editingSource = false
	public currentSourceSelectedTypeIdx?: number
	public currentSource: Source = {} as Source

	// add / edit Device
	public editingDevice = false
	public currentDevice: Device = {} as Device

	// add / edit Device Source
	public editingDeviceSource = false
	public currentDeviceSource: DeviceSource = {} as DeviceSource

	// add / edit Device Actions
	public editingDeviceAction = false
	public currentDeviceAction: DeviceAction = {} as DeviceAction

	// add / edit TSL Client
	public editingTSLClient = false
	public currentTSLClient: TSLClient = {} as TSLClient

	// add / edit Cloud Destination
	public editingCloudDestination = false
	public currentCloudDestination: CloudDestination = {} as CloudDestination

	// add / edit Bus Option
	public editingBusOption = false
	public currentBusOptionSelectedTypeIdx?: number
	public currentBusOption: BusOption = {} as BusOption

	// edit User
	public editingUser = false
	public currentUser: User = {} as User
	public selectedUserRoles: string[] = []

	public newCloudKey = ''

	public configLoaded = false
	public config = {}
	public updatedConfig = {}
	public updatedConfigValid = true
	public updatedRawConfig = ''
	@ViewChild('configEditor', { static: false }) configEditor!: JsonEditorComponent
	public jsonEditorOptions = new JsonEditorOptions()

	public activeNavTab = 'sources_devices'

	constructor(
		private modalService: NgbModal,
		public socketService: SocketService,
		private router: Router,
		public authService: AuthService,
	) {
		this.socketService.joinAdmins()
		this.socketService.closeModals.subscribe(() => this.modalService.dismissAll())
		this.socketService.scrollTallyDataSubject.subscribe(() => this.scrollToBottom(this.tallyDataContainer))
		this.socketService.deviceStateChanged.subscribe((deviceStates) => {
			for (const device of this.socketService.devices) {
				this.deviceBusColors[device.id] = deviceStates
					.filter((d) => d.deviceId == device.id && d.sources.length > 0)
					.map((d) => d.busId)
			}
		})
		this.socketService.newLogsSubject.subscribe(() => {
			this.filterLogs()
			this.scrollToBottom(this.logsContainer)
		})
		if (this.authService.requireRole('admin')) {
			this.socketService.socket.on('server_error', (id: string) => {
				this.show_error(id)
			})
			this.socketService.socket.on('unread_error_reports', (list) => {
				if (list.length > 0) {
					this.show_errors_list()
				}
			})
			this.socketService.socket.emit('get_unread_error_reports')
		}
		if (this.authService.requireRole('settings:users')) {
			this.socketService.socket.emit('users')
		}
		if (this.authService.requireRole('settings:config')) {
			this.socketService.socket.on('config', (config) => {
				this.config = config
				this.updatedConfig = config
				this.updatedRawConfig = JSON.stringify(config, null, 2)
				this.configLoaded = true
				// Check for warnings on initial load - validation will happen when editor is ready
				// Use setTimeout to ensure editor is initialized
				setTimeout(() => {
					let errors: any[] = []
					try {
						if (this.configEditor) {
							const editorJson = this.configEditor.getEditor()
							if (editorJson) {
								editorJson.validate()
								if (editorJson.validateSchema && editorJson.validateSchema.errors) {
									errors = editorJson.validateSchema.errors || []
								} else if (editorJson.validator && editorJson.validator.errors) {
									errors = editorJson.validator.errors || []
								} else if ((editorJson as any).ajv && (editorJson as any).ajv.errors) {
									errors = (editorJson as any).ajv.errors || []
								}
							}
						}
					} catch (e) {
						console.error('Error validating config on load:', e)
					}
					this.checkConfigWarnings(config, errors)
				}, 100)
			})
			this.socketService.socket.emit('get_unread_error_reports')
			this.socketService.socket.emit('get_config')
			this.jsonEditorOptions.schema = configSchema
		}
	}

	public navChanged(event: any) {
		if (event.nextId === 'config') {
			this.socketService.socket.emit('get_config')
		}
	}

	@Confirmable('There was an unexpected error. Do you want to view the bug report?', false)
	public show_error(id: string) {
		this.router.navigate(['/errors', id])
	}

	@Confirmable(`There are error reports that you haven't read yet. Do you want to open the list of errors now?`, false)
	public show_errors_list() {
		this.router.navigate(['/errors'])
	}

	@Confirmable(remoteErrorText, false, optOutAlertOptions)
	public optOutErrorReporting() {
		this.socketService.socket.emit('remote_error_opt', false)
	}

	@Confirmable(remoteErrorText, false, optInAlertOptions)
	public optInErrorReporting() {
		this.socketService.socket.emit('remote_error_opt', true)
	}

	private portInUse(portToCheck: number, sourceId: string) {
		for (const port of this.socketService.portsInUse) {
			if (port.port.toString() === portToCheck.toString()) {
				if (port.sourceId === sourceId) {
					//this source owns this port, it's ok
					return false
				} else {
					//this source doesn't own this port
					return true
				}
			}
		}
		//the port isn't in use, it's ok
		return false
	}

	public setLogLevel(logLevel: string) {
		this.currentLogLevel = logLevel
		this.filterLogs()
		this.scrollToBottom(this.logsContainer)
	}

	private filterLogs() {
		const index = this.logLevels.findIndex((l) => l.id == this.currentLogLevel)
		const allowedLogLevels = this.logLevels.filter((l, i) => i <= index).map((l) => l.id)
		this.visibleLogs = this.socketService.logs.filter((l) => allowedLogLevels.includes(l.type))
	}

	public ngOnInit() {
		this.setLogLevel(this.currentLogLevel)
	}

	public saveDeviceSource() {
		this.editingDeviceSource = false
		const deviceSourceObj = {
			// is fine, the override is intentionally
			// @ts-ignore
			deviceId: this.currentDevice.id,
			...this.currentDeviceSource,
			sourceId: this.socketService.sources[this.currentDeviceSource.sourceIdx!].id,
		} as DeviceSource

		let arbiterObj = {
			action: deviceSourceObj.id !== undefined ? 'edit' : 'add',
			type: 'device_source',
			device_source: deviceSourceObj,
		}

		//reset the currentDeviceSource
		this.currentDeviceSource = {} as DeviceSource

		this.socketService.socket.emit('manage', arbiterObj)
	}

	public reassignListenerClient(client: ListenerClient, newDeviceId: string) {
		this.socketService.socket.emit('reassign', client.id, client.deviceId, newDeviceId)
	}

	public deleteListener(listenerClient: ListenerClient) {
		this.socketService.socket.emit('listener_delete', listenerClient.id)
	}

	public saveCloudKey() {
		this.socketService.socket.emit('manage', {
			action: 'add',
			type: 'cloud_key',
			key: this.newCloudKey,
		})
		this.newCloudKey = ''
		this.modalService.dismissAll()
	}

	public removeCloudClient(client: CloudClient) {
		let arbiterObj = {
			action: 'remove',
			type: 'cloud_client',
			id: client.id,
		}
		this.socketService.socket.emit('manage', arbiterObj)
	}

	public addCloudKey(cloudKeyModal: any) {
		this.modalService.open(cloudKeyModal)
	}

	public saveDeviceAction() {
		this.editingDeviceAction = false
		const deviceActionObj = {
			// is fine, the override is intentionally
			// @ts-ignore
			deviceId: this.currentDevice.id,
			...this.currentDeviceAction,
			outputTypeId: this.socketService.outputTypes[this.currentDeviceAction.outputTypeIdx!].id,
		} as DeviceAction

		let arbiterObj = {
			action: deviceActionObj.id !== undefined ? 'edit' : 'add',
			type: 'device_action',
			device_action: deviceActionObj,
		}
		this.socketService.socket.emit('manage', arbiterObj)
	}

	@Confirmable(
		'If you delete this key, all connected cloud clients using this key will be disconnected. Are you sure you want to delete it?',
	)
	public deleteCloudKey(key: string) {
		const arbiterObj = {
			action: 'delete',
			type: 'cloud_key',
			key,
		}
		this.socketService.socket.emit('manage', arbiterObj)
	}

	public disconnectCloudDestination(cloudDestination: CloudDestination) {
		this.socketService.socket.emit('cloud_destination_disconnect', cloudDestination.id)
	}

	public reconnectCloudDestination(cloudDestination: CloudDestination) {
		this.socketService.socket.emit('cloud_destination_reconnect', cloudDestination.id)
	}

	@Confirmable('Are you sure you want to delete this device?')
	public async deleteDevice(device: Device) {
		let listenerCount = this.socketService.listenerClients.filter((l) => l.deviceId == device.id).length
		if (listenerCount > 0) {
			let result = await Swal.fire({
				title: 'Confirmation',
				text: 'There are listeners connected to this device. Delete anyway?',
				showCancelButton: true,
				icon: 'question',
				focusCancel: true,
				...globalSwalOptions,
			})
			if (!result) {
				return
			}
		}
		let arbiterObj = {
			action: 'delete',
			type: 'device',
			deviceId: device.id,
		}
		this.socketService.socket.emit('manage', arbiterObj)
	}

	public editDeviceSource(deviceSource: DeviceSource) {
		this.currentDeviceSource = {
			...deviceSource,
			sourceIdx: this.socketService.sources.findIndex((s) => s.id == deviceSource.sourceId),
		}
		this.editingDeviceSource = true
	}

	public editDeviceAction(deviceAction: DeviceAction) {
		this.currentDeviceAction = {
			...deviceAction,
			outputTypeIdx: this.socketService.outputTypes.findIndex((t) => t.id == deviceAction.outputTypeId),
		}
		this.editingDeviceAction = true
	}

	public addDeviceAction() {
		this.editingDeviceAction = true
		this.currentDeviceAction = {
			data: {},
		} as DeviceAction
	}

	@Confirmable('Are you sure you want to delete this device source mapping?')
	public deleteDeviceSource(deviceSource: DeviceSource) {
		let arbiterObj = {
			action: 'delete',
			type: 'device_source',
			device_source: {
				id: deviceSource.id,
			},
		}
		this.socketService.socket.emit('manage', arbiterObj)
	}

	@Confirmable('Are you sure you want to delete this TSL Client?')
	public deleteTSLClient(tslClient: TSLClient) {
		let arbiterObj = {
			action: 'delete',
			type: 'tsl_client',
			tslClientId: tslClient.id,
		}
		this.socketService.socket.emit('manage', arbiterObj)
	}

	@Confirmable('Are you sure you want to delete this Bus Option?')
	public deleteBusOption(busOption: BusOption) {
		let arbiterObj = {
			action: 'delete',
			type: 'bus_option',
			busOptionId: busOption.id,
		}
		this.socketService.socket.emit('manage', arbiterObj)
	}

	@Confirmable('Are you sure you want to delete this Cloud Destination?')
	public deleteCloudDestination(cloudDestination: CloudDestination) {
		let arbiterObj = {
			action: 'delete',
			type: 'cloud_destination',
			cloudId: cloudDestination.id,
		}
		this.socketService.socket.emit('manage', arbiterObj)
	}

	@Confirmable('Are you sure you want to delete this action?')
	public deleteDeviceAction(deviceAction: DeviceAction) {
		let arbiterObj = {
			action: 'delete',
			type: 'device_action',
			device_action: {
				id: deviceAction.id,
			},
		}
		this.socketService.socket.emit('manage', arbiterObj)
	}

	public deleteUserButton(user: User) {
		if (this.authService.profile.username === user.username) {
			this.deleteUserAndLogout(user)
		} else {
			this.deleteUser(user)
		}
	}

	@Confirmable('Are you sure you want to delete this user?')
	public deleteUser(user: User) {
		const arbiterObj = {
			action: 'delete',
			type: 'user',
			user: user,
		}
		this.socketService.socket.emit('manage', arbiterObj)
	}

	@Confirmable(
		"You are logged in using this user. Are you sure you want to delete it? You'll be disconnected from this account and redirected to the login page.",
	)
	public deleteUserAndLogout(user: User) {
		const arbiterObj = {
			action: 'delete',
			type: 'user',
			user: user,
		}
		this.socketService.socket.emit('manage', arbiterObj)
		this.authService.logout(['login', 'settings'])
	}

	public getOptionFields(sourceType: SourceType) {
		return this.socketService.sourceTypeDataFields.find((s) => s.sourceTypeId == sourceType.id)?.fields || []
	}

	public getOutputOptionFields(outputType: OutputType) {
		return this.socketService.outputTypeDataFields.find((t) => t.outputTypeId == outputType.id)?.fields || []
	}

	public getSourceBusOptionsBySourceTypeId(sourceTypeId: string): SourceTypeBus[] {
		return this.socketService.sourceTypes.find((obj) => obj.id === sourceTypeId)?.busses as SourceTypeBus[]
	}

	public setTestMode(state: boolean, interval: number = 1000) {
		if (state == true) {
			this.socketService.socket.emit('testmode', true, interval)
			this.socketService.testModeOn = true
		} else if (state == false) {
			this.socketService.socket.emit('testmode', false)
			this.socketService.testModeOn = false
		}
	}

	public checkTestMode() {
		let sources = this.socketService.sources
		let status = false
		for (let i = 0; i < sources.length; i++) {
			if (sources[i].id == 'TEST') {
				status = true
				break
			} else {
				status = false
			}
		}
		return status
	}

	public getDeviceSourcesByDeviceId(deviceId: string) {
		return this.socketService.deviceSources.filter((obj) => obj.deviceId === deviceId)
	}

	public getDeviceActionsByDeviceId(deviceId: string) {
		return this.socketService.deviceActions.filter((obj) => obj.deviceId === deviceId)
	}

	public editDeviceSources(device: Device, deviceSourcesModal: any) {
		this.currentDevice = device
		this.editingDeviceSource = false
		this.modalService.open(deviceSourcesModal, { size: 'lg' })
	}

	public editDeviceActions(device: Device, deviceActionsModal: any) {
		this.currentDevice = device
		this.editingDeviceAction = false
		this.modalService.open(deviceActionsModal, { size: 'lg' })
	}

	@Confirmable('Are you sure you want to delete this source?')
	public deleteSource(source: Source) {
		const arbiterObj = {
			action: 'delete',
			type: 'source',
			sourceId: source.id,
		}
		this.socketService.socket.emit('manage', arbiterObj)
	}

	public saveCurrentSource() {
		if (
			this.currentSource.name === null ||
			this.currentSource.name === undefined ||
			this.currentSource.name.toString().trim().length === 0
		) {
			Swal.fire({
				icon: 'error',
				text: 'The Source needs a name!',
				title: 'Error',
				...globalSwalOptions,
			})
			return
		}
		for (const field of this.getOptionFields(this.socketService.sourceTypes[this.currentSourceSelectedTypeIdx!])) {
			if (field.fieldName != 'info' && !field.optional) {
				if (
					this.currentSource.data[field.fieldName] === null ||
					this.currentSource.data[field.fieldName] === undefined ||
					this.currentSource.data[field.fieldName].toString().trim().length === 0
				) {
					Swal.fire({
						icon: 'error',
						text: 'Not all fields filled out!',
						title: 'Error',
						...globalSwalOptions,
					})
					return
				}
			}
			if (field.fieldType == 'port') {
				if (this.portInUse(this.currentSource.data[field.fieldName], this.currentSource.id)) {
					Swal.fire({
						icon: 'error',
						text: 'This port is already in use. Please pick another!',
						title: 'Error',
						...globalSwalOptions,
					})
					return
				}
			}
		}
		const sourceObj = {
			...this.currentSource,
			sourceTypeId: this.socketService.sourceTypes[this.currentSourceSelectedTypeIdx!].id,
		} as any
		if (!this.editingSource) {
			sourceObj.reconnect = true
			sourceObj.enabled = true
		}
		const arbiterObj = {
			action: this.editingSource ? 'edit' : 'add',
			type: 'source',
			source: sourceObj,
		}
		this.socketService.socket.emit('manage', arbiterObj)
	}

	public saveCurrentDevice() {
		const deviceObj = {
			...this.currentDevice,
		} as Device
		if (!this.editingDevice) {
			deviceObj.enabled = true
		}

		if (parseInt(deviceObj.tslAddress) > 126) {
			deviceObj.tslAddress = '126'
		} else if (parseInt(deviceObj.tslAddress) < 0) {
			deviceObj.tslAddress = ''
		}

		const arbiterObj = {
			action: this.editingDevice ? 'edit' : 'add',
			type: 'device',
			device: deviceObj,
		}
		this.socketService.socket.emit('manage', arbiterObj)
	}

	public saveCurrentTSLClient() {
		const tslClientObj = {
			...this.currentTSLClient,
		} as TSLClient
		const arbiterObj = {
			action: this.editingTSLClient ? 'edit' : 'add',
			type: 'tsl_client',
			tslClient: tslClientObj,
		}
		this.socketService.socket.emit('manage', arbiterObj)
	}

	public saveCurrentCloudDestination() {
		const cloudDestinationObj = {
			...this.currentCloudDestination,
		} as CloudDestination
		const arbiterObj = {
			action: this.editingCloudDestination ? 'edit' : 'add',
			type: 'cloud_destination',
			cloudDestination: cloudDestinationObj,
		}
		this.socketService.socket.emit('manage', arbiterObj)
	}

	public saveCurrentBusOption() {
		const busObj = {
			...this.currentBusOption,
		} as any
		const arbiterObj = {
			action: this.editingBusOption ? 'edit' : 'add',
			type: 'bus_option',
			busOption: busObj,
		}
		this.socketService.socket.emit('manage', arbiterObj)
	}

	public userRolesSelectionChange(selection: string[]) {
		this.currentUser.roles = selection.join(';')
		console.log(selection, this.currentUser)
	}

	public isUserRoleSelected(role: string) {
		return this.currentUser.roles && this.currentUser.roles.split(';').includes(role)
	}

	public saveCurrentUser() {
		const userObj = {
			...this.currentUser,
		} as any
		if (!userObj.password) {
			userObj.password = '12345'
		}
		if (!userObj.roles) {
			userObj.roles = 'tally_view'
		}
		const arbiterObj = {
			action: this.editingUser ? 'edit' : 'add',
			type: 'user',
			user: userObj,
		}
		this.socketService.socket.emit('manage', arbiterObj)
	}

	public getBusById(busId: string) {
		return this.socketService.busOptions.find(({ id }) => id === busId)
	}

	public addSource(modal: any) {
		this.editingSource = false
		this.currentSourceSelectedTypeIdx = undefined
		this.currentSource = {
			data: {},
		} as Source
		this.modalService.open(modal)
	}

	public addDevice(modal: any) {
		this.editingDevice = false
		this.currentDevice = {} as Device
		this.modalService.open(modal)
	}

	public addTSLClient(modal: any) {
		this.editingTSLClient = false
		this.currentTSLClient = this.createDefaultTSLClient() as TSLClient
		this.modalService.open(modal)
	}

	private createDefaultTSLClient(): any {
		return {
			ip: '127.0.0.1',
			port: 5720,
			transport: 'udp',
			protocol: '3.1',
			protocolOptions: {
				brightness: 3,

				// 3.1 defaults
				tally1: 'pvw',
				tally2: 'pgm',
				tally3: 'off',
				tally4: 'off',

				// 5.0 defaults
				lh_tally: 'pgm',
				rh_tally: 'pvw',
				text_tally: 'off',
				sequence: 'ON',
			},
		}
	}

	public addCloudDestination(modal: any) {
		this.editingCloudDestination = false
		this.currentCloudDestination = {} as CloudDestination
		this.modalService.open(modal)
	}

	public addUser(userModal: any) {
		this.editingUser = false
		this.currentUser = {} as User
		this.selectedUserRoles = []
		this.modalService.open(userModal)
	}

	public getOutputTypeById(outputTypeId: string) {
		return this.socketService.outputTypes.find(({ id }) => id === outputTypeId)
	}

	public getSourceTypeById(sourceTypeId: string) {
		return this.socketService.sourceTypes.find((sourceType) => sourceType.id === sourceTypeId)
	}

	public getNetworkDiscoveryList() {
		return this.socketService.networkDiscovery.filter((el) => this.checkIfNetworkDiscoveryAlreadyAdded(el))
	}

	public checkIfNetworkDiscoveryAlreadyAdded(networkDiscovery: NetworkDiscovery) {
		return this.socketService.sources.every((source) => {
			return !(networkDiscovery.sourceId === source.sourceTypeId && networkDiscovery.addresses.includes(source.data.ip))
		})
	}

	public changeIpSelection(networkDiscovery: NetworkDiscovery, ip: string) {
		networkDiscovery.ip = ip
	}

	public addSourceByNetworkDiscovery(discovered: NetworkDiscovery, modal: any) {
		this.editingSource = false
		this.currentSourceSelectedTypeIdx = this.socketService.sourceTypes.findIndex((t) => t.id == discovered.sourceId)
		this.currentSource = {
			name: discovered.name,
			data: {
				...discovered,
			},
		} as unknown as Source
		delete this.currentSource.data.sourceId
		delete this.currentSource.data.name

		this.modalService.open(modal)
	}

	public editSource(source: Source, modal: any) {
		this.editingSource = true
		this.currentSourceSelectedTypeIdx = this.socketService.sourceTypes.findIndex((t) => t.id == source.sourceTypeId)
		this.currentSource = {
			...source,
			data: {
				...source.data,
			},
		} as Source
		this.modalService.open(modal)
	}
	public editDevice(device: Device, modal: any) {
		this.editingDevice = true
		this.currentDevice = {
			...device,
		} as Device
		this.modalService.open(modal)
	}

	public onProtocolChanged(protocol: '3.1' | '5.0') {
		this.currentTSLClient.protocolOptions ??= {}

		if (protocol === '3.1') {
			this.currentTSLClient.protocolOptions.tally1 ??= 'pvw'
			this.currentTSLClient.protocolOptions.tally2 ??= 'pgm'
			this.currentTSLClient.protocolOptions.tally3 ??= 'off'
			this.currentTSLClient.protocolOptions.tally4 ??= 'off'
		} else {
			this.currentTSLClient.protocolOptions.lh_tally ??= 'pgm'
			this.currentTSLClient.protocolOptions.rh_tally ??= 'pvw'
			this.currentTSLClient.protocolOptions.text_tally ??= 'pgm'
			this.currentTSLClient.protocolOptions.sequence ??= 'ON'
		}

		this.currentTSLClient.protocolOptions.brightness ??= 3
	}

	public editTSLClient(tslClient: TSLClient, modal: any) {
		this.editingTSLClient = true
		this.currentTSLClient = this.normalizeTSLClient({ ...tslClient }) as TSLClient
		this.modalService.open(modal)
	}

	private normalizeTSLClient(client: any): any {
		const out = { ...client }

		//if protocol is missing, default to "3.1"
		out.protocol ??= '3.1'

		//if transport is missing, default to "udp"
		out.transport ??= 'udp'

		// Ensure protocolOptions exists
		out.protocolOptions ??= {}

		// Always-safe defaults (only fill if missing)
		out.protocolOptions.brightness ??= 3

		// 3.1 default mapping
		out.protocolOptions.tally1 ??= 'pvw'
		out.protocolOptions.tally2 ??= 'pgm'
		out.protocolOptions.tally3 ??= 'off'
		out.protocolOptions.tally4 ??= 'off'

		// 5.0 default mapping
		out.protocolOptions.lh_tally ??= 'pgm'
		out.protocolOptions.rh_tally ??= 'pvw'
		out.protocolOptions.text_tally ??= 'off'
		out.protocolOptions.sequence ??= 'ON'

		return out
	}

	public editCloudDestination(cloudDestination: CloudDestination, modal: any) {
		this.editingCloudDestination = true
		this.currentCloudDestination = {
			...cloudDestination,
		} as CloudDestination
		this.modalService.open(modal)
	}

	public addBusOption(modal: any) {
		this.editingBusOption = false
		this.currentBusOption = {} as BusOption
		this.modalService.open(modal)
	}

	public editBusOption(bus: BusOption, modal: any) {
		this.editingBusOption = true
		this.currentBusOptionSelectedTypeIdx = this.socketService.busOptions.findIndex((t) => t.id == bus.id)
		this.currentBusOption = {
			...bus,
		} as BusOption
		this.modalService.open(modal)
	}

	public editUser(user: User, modal: any) {
		this.editingUser = true
		this.currentUser = user
		this.selectedUserRoles = user.roles.split(';')
		this.modalService.open(modal)
	}

	public reconnect(source: Source): void {
		this.socketService.socket.emit('reconnect_source', source.id)
	}

	public flash(listenerClient: ListenerClient) {
		this.socketService.socket.emit('flash', listenerClient.id)
	}

	private scrollToBottom(e: ElementRef) {
		setTimeout(() => {
			try {
				e.nativeElement.scrollTop = e.nativeElement.scrollHeight
			} catch {}
		})
	}

	public configWarnings: Array<{ path: string; message: string; fix: () => void }> = []

	public configUpdated(event: any) {
		this.updatedConfig = event
		this.updatedRawConfig = JSON.stringify(event, null, 2)

		// Get validation errors from the JSON editor (it uses Ajv internally)
		let errors: any[] = []
		try {
			if (this.configEditor) {
				const editorJson = this.configEditor.getEditor()
				if (editorJson) {
					// Trigger validation
					editorJson.validate()

					// Try to access validation errors from the editor
					// jsoneditor uses Ajv internally and stores errors in validateSchema.errors
					if (editorJson.validateSchema && editorJson.validateSchema.errors) {
						errors = editorJson.validateSchema.errors || []
					} else if (editorJson.validator && editorJson.validator.errors) {
						errors = editorJson.validator.errors || []
					} else if ((editorJson as any).ajv && (editorJson as any).ajv.errors) {
						// Direct access to Ajv instance
						errors = (editorJson as any).ajv.errors || []
					}
				}
			}
		} catch (e) {
			console.error('Error accessing validation errors:', e)
		}

		if (errors && errors.length > 0) {
			this.updatedConfigValid = false
		} else {
			this.updatedConfigValid = true
		}

		// Check for missing optional properties that should have defaults
		// Also check for missing required properties from schema validation
		this.checkConfigWarnings(event, errors)
	}

	private checkConfigWarnings(config: any, schemaErrors: any[] = []) {
		const warnings: Array<{ path: string; message: string; fix: () => void }> = []

		// Check for missing top-level properties
		const defaults = this.getConfigDefaults()
		this.findMissingProperties(config, defaults, '', warnings)

		// Check for missing required properties from schema validation errors
		if (schemaErrors && schemaErrors.length > 0) {
			this.parseSchemaValidationErrors(schemaErrors, config, warnings)
		}

		this.configWarnings = warnings
	}

	private getConfigDefaults(): any {
		// These should match ConfigDefaults from src/_helpers/config.ts
		return {
			security: {
				jwt_private_key: '',
			},
			users: [],
			cloud_destinations: [],
			cloud_keys: [],
			device_actions: [],
			device_sources: [],
			devices: [],
			sources: [],
			tsl_clients: [],
			tsl_clients_1secupdate: false,
			bus_options: [
				{ id: 'e393251c', label: 'Preview', type: 'preview', color: '#3fe481', priority: 50, visible: true },
				{ id: '334e4eda', label: 'Program', type: 'program', color: '#e43f5a', priority: 200, visible: true },
				{ id: '12c8d699', label: 'Aux 1', type: 'aux', color: '#0000FF', priority: 100, visible: true },
				{ id: '0449b0c7', label: 'Aux 2', type: 'aux', color: '#0000FF', priority: 100, visible: true },
				{ id: '5d94f273', label: 'Aux 3', type: 'aux', color: '#0000FF', priority: 100, visible: false },
				{ id: '77ffb605', label: 'Aux 4', type: 'aux', color: '#0000FF', priority: 100, visible: false },
				{ id: '09d4975d', label: 'Aux 5', type: 'aux', color: '#0000FF', priority: 100, visible: false },
				{ id: 'e2c2e192', label: 'Aux 6', type: 'aux', color: '#0000FF', priority: 100, visible: false },
				{ id: '734f7395', label: 'Aux 7', type: 'aux', color: '#0000FF', priority: 100, visible: false },
				{ id: '3011d34a', label: 'Aux 8', type: 'aux', color: '#0000FF', priority: 100, visible: false },
			],
			externalAddress: 'http://0.0.0.0:4455/#/tally',
			remoteErrorReporting: false,
			uuid: '',
			mqtt: {
				enabled: false,
				broker: 'localhost',
				port: 1883,
				username: '',
				password: '',
				topicPrefix: 'tallyarbiter',
				retain: true,
				qos: 0,
			},
		}
	}

	private findMissingProperties(
		config: any,
		defaults: any,
		path: string,
		warnings: Array<{ path: string; message: string; fix: () => void }>,
	) {
		for (const [key, defaultValue] of Object.entries(defaults)) {
			const currentPath = path ? `${path}.${key}` : key

			// Check if property exists in config
			if (config[key] === undefined) {
				// Property is missing
				if (Array.isArray(defaultValue)) {
					warnings.push({
						path: currentPath,
						message: `Property "${currentPath}" is missing. Default value: empty array []`,
						fix: () => {
							this.applyPropertyDefault(currentPath, defaultValue)
						},
					})
				} else if (defaultValue !== null && typeof defaultValue === 'object' && !Array.isArray(defaultValue)) {
					// It's an object - warn about missing object
					warnings.push({
						path: currentPath,
						message: `Property "${currentPath}" is missing. This will be added with default values.`,
						fix: () => {
							this.applyPropertyDefault(currentPath, defaultValue)
						},
					})
				} else {
					// Primitive value
					const displayValue =
						typeof defaultValue === 'string' && defaultValue.length > 50
							? defaultValue.substring(0, 50) + '...'
							: JSON.stringify(defaultValue)
					warnings.push({
						path: currentPath,
						message: `Property "${currentPath}" is missing. Default value: ${displayValue}`,
						fix: () => {
							this.applyPropertyDefault(currentPath, defaultValue)
						},
					})
				}
			} else if (
				defaultValue !== null &&
				typeof defaultValue === 'object' &&
				!Array.isArray(defaultValue) &&
				typeof config[key] === 'object' &&
				!Array.isArray(config[key])
			) {
				// Both are objects - recurse to check nested properties
				this.findMissingProperties(config[key], defaultValue, currentPath, warnings)
			}
			// If config[key] exists and is not an object, or if it's an array, we don't need to check further
		}
	}

	private parseSchemaValidationErrors(
		errors: any[],
		config: any,
		warnings: Array<{ path: string; message: string; fix: () => void }>,
	) {
		if (!errors || errors.length === 0) {
			return
		}

		const arrayItemDefaults = this.getArrayItemDefaults()

		for (const error of errors) {
			// Only handle "required" errors (missing required properties)
			if (error.keyword === 'required' && error.params && error.params.missingProperty) {
				const missingProperty = error.params.missingProperty
				// Try different path properties (AJV v6 vs v7+)
				const dataPath = error.dataPath || error.instancePath || error.path || ''

				// Parse the dataPath - format is ".device_sources[0]"
				// Remove leading dot and extract property name and index
				const cleanPath = dataPath.replace(/^\.+/, '')
				const match = cleanPath.match(/^([^[\]]+)\[(\d+)\]$/)

				if (!match) {
					console.warn(`Unexpected path format: ${dataPath}`)
					continue
				}

				const pathParts = [match[1], match[2]] // ["device_sources", "0"]
				const displayPath = `${match[1]}[${match[2]}].${missingProperty}`
				const defaultValue = this.getDefaultValueForProperty(pathParts, missingProperty, arrayItemDefaults)

				// Create fix function
				const fix = () => {
					this.applyPropertyDefaultFromPath(pathParts, missingProperty, defaultValue)
				}

				// Check if we already have a warning for this path
				const existingWarning = warnings.find((w) => w.path === displayPath)
				if (!existingWarning) {
					const displayValue =
						typeof defaultValue === 'string' && defaultValue.length > 50
							? defaultValue.substring(0, 50) + '...'
							: JSON.stringify(defaultValue)

					warnings.push({
						path: displayPath,
						message: `Missing required property "${missingProperty}". Default value: ${displayValue}`,
						fix: fix,
					})
				}
			}
		}
	}

	private getArrayItemDefaults(): any {
		// Default values for properties within array items
		return {
			device_sources: {
				reconnect_interval: 5000,
				max_reconnects: 5,
				rename: false,
				bus: '',
				address: '',
				deviceId: '',
				id: '',
				sourceId: '',
			},
			device_actions: {
				active: false,
			},
			devices: {},
			sources: {
				reconnect_interval: 5000,
				max_reconnects: 5,
			},
		}
	}

	private getDefaultValueForProperty(pathParts: string[], propertyName: string, arrayItemDefaults: any): any {
		// If this is an array item (pathParts has a numeric last part)
		if (pathParts.length >= 2) {
			const arrayName = pathParts[pathParts.length - 2]
			const itemDefaults = arrayItemDefaults[arrayName]
			if (itemDefaults && itemDefaults[propertyName] !== undefined) {
				return itemDefaults[propertyName]
			}
		}

		// Default based on property name patterns
		if (propertyName.includes('interval') || propertyName.includes('Interval')) {
			return 5000
		}
		if (propertyName.includes('reconnect') || propertyName.includes('Reconnect')) {
			return 5
		}
		if (
			propertyName.includes('enabled') ||
			propertyName.includes('Enabled') ||
			propertyName.includes('active') ||
			propertyName.includes('Active')
		) {
			return false
		}
		if (propertyName.includes('rename') || propertyName.includes('Rename')) {
			return false
		}
		if (propertyName.includes('id') || propertyName.includes('Id')) {
			return ''
		}
		// For string properties like "bus", "address", etc., return empty string
		if (propertyName === 'bus' || propertyName === 'address' || propertyName === 'name' || propertyName === 'label') {
			return ''
		}

		// Generic defaults - return empty string for unknown properties (safer than null)
		// This prevents type errors when the schema expects a string but gets null
		return ''
	}

	private applyPropertyDefaultFromPath(pathParts: string[], propertyName: string, defaultValue: any) {
		// Create a working copy to avoid mutating the original during navigation
		let target: any = this.updatedConfig

		console.log(`Applying fix: path=${pathParts.join('.')}, property=${propertyName}, value=${defaultValue}`)

		// Navigate to the target object
		for (let i = 0; i < pathParts.length; i++) {
			const part = pathParts[i]
			// Check if part is a numeric index (array)
			const index = parseInt(part, 10)
			const isNumericIndex = !isNaN(index) && part === index.toString()

			if (isNumericIndex) {
				// It's a numeric index - target should be an array
				if (!Array.isArray(target)) {
					console.warn(`Expected array at ${pathParts.slice(0, i).join('.')}, got ${typeof target}`)
					return
				}
				if (target[index] === undefined) {
					console.warn(`Array index ${index} does not exist in ${pathParts.slice(0, i).join('.')}`)
					return
				}
				target = target[index]
			} else {
				// It's a property name
				if (target[part] === undefined) {
					// Check if next part is a numeric index - if so, this should be an array
					if (i < pathParts.length - 1) {
						const nextPart = pathParts[i + 1]
						const nextIndex = parseInt(nextPart, 10)
						if (!isNaN(nextIndex) && nextPart === nextIndex.toString()) {
							// Next part is an array index, so this should be an array
							target[part] = []
						} else {
							target[part] = {}
						}
					} else {
						// This is the final part, but we're setting a property on it, so it should be an object
						// This shouldn't happen for array item fixes, but handle it anyway
						target[part] = {}
					}
				} else if (!Array.isArray(target[part]) && typeof target[part] !== 'object') {
					// If it's not an object or array, we can't navigate further
					console.warn(`Cannot navigate to property ${part} in path ${pathParts.join('.')} - not an object`)
					return
				}
				target = target[part]
			}
		}

		// Set the property value on the array item object
		target[propertyName] = defaultValue

		// Create a deep copy to ensure Angular detects the change
		const newConfig = JSON.parse(JSON.stringify(this.updatedConfig))
		this.updatedConfig = newConfig
		this.config = newConfig
		this.updatedRawConfig = JSON.stringify(newConfig, null, 2)

		// Revalidate after editor updates
		setTimeout(() => {
			this.configUpdated(newConfig)
		}, 200)
	}

	private applyPropertyDefault(path: string, defaultValue: any) {
		const pathParts = path.split('.')
		let target: any = this.updatedConfig

		// Navigate to the parent object
		for (let i = 0; i < pathParts.length - 1; i++) {
			const part = pathParts[i]
			if (!target[part] || typeof target[part] !== 'object') {
				target[part] = {}
			}
			target = target[part]
		}

		// Set the value
		const finalKey = pathParts[pathParts.length - 1]

		// If it's an object, merge with existing values
		if (defaultValue !== null && typeof defaultValue === 'object' && !Array.isArray(defaultValue)) {
			target[finalKey] = {
				...defaultValue,
				...(target[finalKey] || {}),
			}
		} else {
			target[finalKey] = defaultValue
		}

		// Create a deep copy to ensure we have a fresh object reference
		const newConfig = JSON.parse(JSON.stringify(this.updatedConfig))

		// Update all config references with the new deep copy
		this.updatedConfig = newConfig
		this.config = newConfig // This is bound to [data] in the template, so updating it will update the editor
		this.updatedRawConfig = JSON.stringify(newConfig, null, 2)

		// Trigger validation and recheck warnings after Angular updates the editor
		setTimeout(() => {
			this.configUpdated(newConfig)
		}, 200)
	}

	public fixConfigWarning(warning: { path: string; message: string; fix: () => void }) {
		warning.fix()
		Swal.fire({
			title: 'Fixed!',
			text: `Applied default value for ${warning.path}`,
			icon: 'success',
			timer: 2000,
			showConfirmButton: false,
			...globalSwalOptions,
		})
	}

	public fixAllConfigWarnings() {
		if (this.configWarnings.length === 0) {
			return
		}

		// Collect all changes that will be applied
		const changes: Array<{ path: string; value: string }> = []
		for (const warning of this.configWarnings) {
			// Extract the value from the warning message
			const valueMatch = warning.message.match(/Default value: (.+)$/)
			const displayValue = valueMatch ? valueMatch[1] : 'default'
			changes.push({
				path: warning.path,
				value: displayValue,
			})
		}

		// Apply all fixes by directly modifying the config
		// This is more efficient than calling each fix() individually
		const config: any = this.updatedConfig
		for (const warning of this.configWarnings) {
			// Extract path parts from warning path (e.g., "device_sources[0].bus" -> ["device_sources", "0", "bus"])
			const pathMatch = warning.path.match(/^([^[\]]+)\[(\d+)\]\.(.+)$/)
			if (pathMatch) {
				const arrayName = pathMatch[1]
				const index = parseInt(pathMatch[2], 10)
				const propertyName = pathMatch[3]

				// Get the default value
				const arrayItemDefaults = this.getArrayItemDefaults()
				const defaultValue = this.getDefaultValueForProperty(
					[arrayName, index.toString()],
					propertyName,
					arrayItemDefaults,
				)

				// Apply the fix directly
				if (config[arrayName] && Array.isArray(config[arrayName]) && config[arrayName][index]) {
					config[arrayName][index][propertyName] = defaultValue
				}
			} else {
				// For non-array paths, use the existing fix function
				warning.fix()
			}
		}

		// Create a deep copy and update all references
		const newConfig = JSON.parse(JSON.stringify(this.updatedConfig))
		this.updatedConfig = newConfig
		this.config = newConfig
		this.updatedRawConfig = JSON.stringify(newConfig, null, 2)

		// Revalidate after all fixes are applied
		setTimeout(() => {
			this.configUpdated(newConfig)

			// Show summary of changes
			let summaryHtml = `<div style="text-align: left;"><p><strong>Applied ${changes.length} fixes:</strong></p><ul style="margin-top: 10px; max-height: 400px; overflow-y: auto;">`
			for (const change of changes) {
				summaryHtml += `<li style="margin-bottom: 5px;"><strong>${change.path}</strong>: <code>${change.value}</code></li>`
			}
			summaryHtml += '</ul></div>'

			Swal.fire({
				title: 'All Fixed!',
				html: summaryHtml,
				icon: 'success',
				confirmButtonText: 'OK',
				width: '600px',
				...globalSwalOptions,
			})
		}, 300)
	}

	@Confirmable('Are you sure you want to update your config? Be careful and continue only if you are absolutely sure.')
	public saveConfig() {
		console.log(this.updatedConfig)
		this.config = this.updatedConfig
		this.socketService.socket.once('error', (message: string) => {
			alert(message)
		})
		this.socketService.socket.emit('set_config', this.config)
	}

	@Confirmable('Are you sure you want to update your config? Be careful and continue only if you are absolutely sure.')
	public saveRawConfig() {
		console.log(this.updatedRawConfig)
		this.config = JSON.parse(this.updatedRawConfig)
		this.socketService.socket.once('error', (message: string) => {
			alert(message)
		})
		this.socketService.socket.emit('set_config', this.config)
	}

	public exportConfig() {
		const blob = new Blob([JSON.stringify(this.config, null, 2)], { type: 'application/json' })
		const url = window.URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = 'config.json'
		a.click()
	}

	public importConfig() {
		try {
			const input = document.createElement('input')
			input.type = 'file'
			input.onchange = (e) => {
				const reader = new FileReader()
				reader.onload = (e) => {
					if (e?.target?.result) {
						let result = e?.target?.result as string
						console.log('file contents:', result)
						this.config = JSON.parse(result)
						this.updatedConfig = this.config
						this.updatedRawConfig = JSON.stringify(this.config, null, 2)

						// Update the JSON editor with the new config
						if (this.configEditor) {
							this.configEditor.set(this.config as any)
						}

						// Trigger validation and check for warnings after import
						setTimeout(() => {
							let errors: any[] = []
							try {
								if (this.configEditor) {
									const editorJson = this.configEditor.getEditor()
									if (editorJson) {
										editorJson.validate()
										if (editorJson.validateSchema && editorJson.validateSchema.errors) {
											errors = editorJson.validateSchema.errors || []
										} else if (editorJson.validator && editorJson.validator.errors) {
											errors = editorJson.validator.errors || []
										} else if ((editorJson as any).ajv && (editorJson as any).ajv.errors) {
											errors = (editorJson as any).ajv.errors || []
										}
									}
								}
							} catch (err) {
								console.error('Error validating imported config:', err)
							}

							// Update validation status
							if (errors && errors.length > 0) {
								this.updatedConfigValid = false
							} else {
								this.updatedConfigValid = true
							}

							// Check for warnings with validation errors
							this.checkConfigWarnings(this.config, errors)
						}, 100)

						this.socketService.socket.emit('set_config', this.config)
					}
				}
				reader.readAsText((input.files as FileList)[0])
			}
			input.click()
		} catch (e) {
			console.error('Error importing config:', e)
		}
	}
}
