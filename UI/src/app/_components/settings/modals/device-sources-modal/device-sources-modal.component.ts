import { Component, ChangeDetectionStrategy, Input, computed, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import Swal from 'sweetalert2'
import { Confirmable } from 'src/app/_decorators/confirmable.decorator'
import { Device } from 'src/app/_models/Device'
import { DeviceSource } from 'src/app/_models/DeviceSource'
import { SourceTypeBus } from 'src/app/_models/SourceTypeBus'
import { SocketService } from 'src/app/_services/socket.service'

const globalSwalOptions = {
	confirmButtonColor: '#2a70c7',
}

@Component({
	selector: 'app-device-sources-modal',
	standalone: true,
	imports: [FormsModule],
	templateUrl: './device-sources-modal.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['../../settings.component.scss'],
})
export class DeviceSourcesModalComponent {
	public readonly activeModal = inject(NgbActiveModal)
	public readonly socketService = inject(SocketService)

	@Input() device: Device = {} as Device

	public currentDeviceSource: DeviceSource = {} as DeviceSource
	public editingDeviceSource = false

	//`device` never changes for a given modal instance, so reading it inside the
	//computed is enough — the socket signal is what drives recomputation
	public readonly deviceSources = computed(() =>
		this.socketService.deviceSources().filter((obj) => obj.deviceId === this.device.id),
	)

	public getSourceBusOptionsBySourceTypeId(sourceTypeId: string): SourceTypeBus[] {
		return this.socketService.sourceTypes().find((obj) => obj.id === sourceTypeId)?.busses as SourceTypeBus[]
	}

	public editDeviceSource(deviceSource: DeviceSource) {
		this.currentDeviceSource = {
			...deviceSource,
			sourceIdx: this.socketService.sources().findIndex((s) => s.id == deviceSource.sourceId),
		}
		this.editingDeviceSource = true
	}

	public saveDeviceSource() {
		const sourceIdx = this.currentDeviceSource.sourceIdx
		if (sourceIdx === undefined || sourceIdx === -1 || !this.socketService.sources()[sourceIdx]) {
			Swal.fire({ icon: 'error', text: 'Please select a source!', title: 'Error', ...globalSwalOptions })
			return
		}

		this.editingDeviceSource = false
		const deviceSourceObj = {
			// the spread intentionally overrides deviceId when editing an existing row
			// @ts-ignore
			deviceId: this.device.id,
			...this.currentDeviceSource,
			sourceId: this.socketService.sources()[sourceIdx].id,
		} as DeviceSource

		//reset before emitting so the form is blank for the next entry
		this.currentDeviceSource = {} as DeviceSource

		this.socketService.socket.emit('manage', {
			action: deviceSourceObj.id !== undefined ? 'edit' : 'add',
			type: 'device_source',
			device_source: deviceSourceObj,
		})
	}

	@Confirmable('Are you sure you want to delete this device source mapping?')
	public deleteDeviceSource(deviceSource: DeviceSource) {
		this.socketService.socket.emit('manage', {
			action: 'delete',
			type: 'device_source',
			device_source: { id: deviceSource.id },
		})
	}
}
