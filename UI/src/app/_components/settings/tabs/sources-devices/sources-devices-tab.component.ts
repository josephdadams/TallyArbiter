import { Component, OnDestroy, ChangeDetectionStrategy, computed, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { Subscription } from 'rxjs'
import Swal from 'sweetalert2'
import { Confirmable } from 'src/app/_decorators/confirmable.decorator'
import { Device } from 'src/app/_models/Device'
import { NetworkDiscovery } from 'src/app/_models/NetworkDiscovery'
import { Source } from 'src/app/_models/Source'
import { SocketService } from 'src/app/_services/socket.service'
import { DevicesTableComponent } from '../../shared/devices-table/devices-table.component'
import { DeviceActionsModalComponent } from '../../modals/device-actions-modal/device-actions-modal.component'
import { DeviceModalComponent } from '../../modals/device-modal/device-modal.component'
import { DeviceSourcesModalComponent } from '../../modals/device-sources-modal/device-sources-modal.component'
import { SourceModalComponent } from '../../modals/source-modal/source-modal.component'

const globalSwalOptions = {
	confirmButtonColor: '#2a70c7',
}

@Component({
	selector: 'app-sources-devices-tab',
	standalone: true,
	imports: [FormsModule, DevicesTableComponent],
	templateUrl: './sources-devices-tab.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SourcesDevicesTabComponent implements OnDestroy {
	private readonly modalService = inject(NgbModal)
	public readonly socketService = inject(SocketService)

	/** discovered devices that aren't already configured as a source */
	public readonly networkDiscoveryList = computed(() =>
		this.socketService
			.networkDiscovery()
			.filter((discovered) =>
				this.socketService
					.sources()
					.every(
						(source) => !(discovered.sourceId === source.sourceTypeId && discovered.addresses.includes(source.data.ip)),
					),
			),
	)

	private readonly subscriptions: Subscription[] = []

	constructor() {
		this.subscriptions.push(this.socketService.deviceDuplicated.subscribe(() => this.onDeviceDuplicated()))
	}

	public ngOnDestroy() {
		for (const subscription of this.subscriptions) {
			subscription.unsubscribe()
		}
	}

	public getSourceTypeById(sourceTypeId: string) {
		return this.socketService.sourceTypes().find((sourceType) => sourceType.id === sourceTypeId)
	}

	public changeIpSelection(networkDiscovery: NetworkDiscovery, ip: string) {
		networkDiscovery.ip = ip
	}

	// --- sources -------------------------------------------------------------

	public addSource() {
		this.openSourceModal({ data: {} } as Source, false, undefined)
	}

	public editSource(source: Source) {
		this.openSourceModal(
			{ ...source, data: { ...source.data } } as Source,
			true,
			this.socketService.sourceTypes().findIndex((t) => t.id == source.sourceTypeId),
		)
	}

	public addSourceByNetworkDiscovery(discovered: NetworkDiscovery) {
		const source = {
			name: discovered.name,
			data: { ...discovered },
		} as unknown as Source
		delete source.data.sourceId
		delete source.data.name

		this.openSourceModal(
			source,
			false,
			this.socketService.sourceTypes().findIndex((t) => t.id == discovered.sourceId),
		)
	}

	private openSourceModal(source: Source, editing: boolean, sourceTypeIdx: number | undefined) {
		const ref = this.modalService.open(SourceModalComponent)
		ref.componentInstance.source = source
		ref.componentInstance.editing = editing
		ref.componentInstance.sourceTypeIdx = sourceTypeIdx
	}

	@Confirmable('Are you sure you want to delete this source?')
	public deleteSource(source: Source) {
		this.socketService.socket.emit('manage', { action: 'delete', type: 'source', sourceId: source.id })
	}

	public reconnect(source: Source): void {
		this.socketService.socket.emit('reconnect_source', source.id)
	}

	// --- devices -------------------------------------------------------------

	public addDevice() {
		const ref = this.modalService.open(DeviceModalComponent)
		ref.componentInstance.device = {} as Device
		ref.componentInstance.editing = false
	}

	public editDevice(device: Device) {
		const ref = this.modalService.open(DeviceModalComponent)
		ref.componentInstance.device = { ...device } as Device
		ref.componentInstance.editing = true
	}

	public editDeviceSources(device: Device) {
		const ref = this.modalService.open(DeviceSourcesModalComponent, { size: 'lg' })
		ref.componentInstance.device = device
	}

	public editDeviceActions(device: Device) {
		const ref = this.modalService.open(DeviceActionsModalComponent, { size: 'lg' })
		ref.componentInstance.device = device
	}

	// Creates the copy straight away rather than opening a pre-filled Add Device modal. The user's
	// flow is "duplicate this camera five times, then tweak each one": a modal would force them
	// through a save dialog before they even have the copy, and it could only ever cover the device's
	// own fields - the device sources and device actions that make the duplicate worth having are
	// edited from two entirely different modals anyway. Creating immediately also means five clicks
	// gets five copies, and they can edit them in any order afterwards.
	public duplicateDevice(device: Device) {
		this.socketService.socket.emit('manage', { action: 'duplicate', type: 'device', deviceId: device.id })
	}

	private onDeviceDuplicated() {
		Swal.fire({
			icon: 'success',
			title: 'Device duplicated',
			text: 'Its sources and actions were copied too. The copy is disabled and has no TSL address until you edit it.',
			toast: true,
			position: 'top-end',
			showConfirmButton: false,
			timer: 6000,
			timerProgressBar: true,
			...globalSwalOptions,
		})
	}

	@Confirmable('Are you sure you want to delete this device?')
	public async deleteDevice(device: Device) {
		const listenerCount = this.socketService.listenerClients().filter((l) => l.deviceId == device.id).length
		if (listenerCount > 0) {
			const result = await Swal.fire({
				title: 'Confirmation',
				text: 'There are listeners connected to this device. Delete anyway?',
				showCancelButton: true,
				icon: 'question',
				focusCancel: true,
				...globalSwalOptions,
			})
			if (!result.isConfirmed) {
				return
			}
		}

		this.socketService.socket.emit('manage', { action: 'delete', type: 'device', deviceId: device.id })
	}
}
