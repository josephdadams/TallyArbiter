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
		this.currentTSLClient = {} as TSLClient
		this.modalService.open(modal)
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
	public editTSLClient(tslClient: TSLClient, modal: any) {
		this.editingTSLClient = true
		this.currentTSLClient = {
			...tslClient,
		} as TSLClient
		this.modalService.open(modal)
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

	public configUpdated(event: any) {
		console.log(event, this.configEditor)
		this.updatedConfig = event
		this.updatedRawConfig = JSON.stringify(event, null, 2)

		const editorJson = this.configEditor.getEditor()
		console.log(editorJson)
		editorJson.validate()
		const errors = editorJson.validateSchema.errors
		if (errors && errors.length > 0) {
			this.updatedConfigValid = false
		} else {
			this.updatedConfigValid = true
		}
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
						this.socketService.socket.emit('set_config', this.config)
					}
				}
				reader.readAsText((input.files as FileList)[0])
			}
			input.click()
		} catch (e) {}
	}
}
