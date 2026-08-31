import { Component, ChangeDetectionStrategy, Input, computed, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import Swal from 'sweetalert2'
import { Confirmable } from 'src/app/_decorators/confirmable.decorator'
import { BusOption } from 'src/app/_models/BusOption'
import { Device } from 'src/app/_models/Device'
import { DeviceAction } from 'src/app/_models/DeviceAction'
import { OutputType } from 'src/app/_models/OutputType'
import { SocketService } from 'src/app/_services/socket.service'

const globalSwalOptions = {
	confirmButtonColor: '#2a70c7',
}

@Component({
	selector: 'app-device-actions-modal',
	standalone: true,
	imports: [FormsModule],
	templateUrl: './device-actions-modal.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['../../settings.component.scss'],
})
export class DeviceActionsModalComponent {
	public readonly activeModal = inject(NgbActiveModal)
	public readonly socketService = inject(SocketService)

	@Input() device: Device = {} as Device

	public currentDeviceAction: DeviceAction = {} as DeviceAction
	public editingDeviceAction = false

	//`device` never changes for a given modal instance, so reading it inside the
	//computed is enough — the socket signal is what drives recomputation
	public readonly deviceActions = computed(() =>
		this.socketService.deviceActions().filter((obj) => obj.deviceId === this.device.id),
	)

	public getOutputOptionFields(outputType: OutputType) {
		return this.socketService.outputTypeDataFields().find((t) => t.outputTypeId == outputType.id)?.fields || []
	}

	public getOutputTypeById(outputTypeId: string) {
		return this.socketService.outputTypes().find(({ id }) => id === outputTypeId)
	}

	public getBusById(busId: string): BusOption | undefined {
		return this.socketService.busOptions().find(({ id }) => id === busId)
	}

	public addDeviceAction() {
		this.editingDeviceAction = true
		this.currentDeviceAction = { data: {} } as DeviceAction
	}

	public editDeviceAction(deviceAction: DeviceAction) {
		this.currentDeviceAction = {
			...deviceAction,
			outputTypeIdx: this.socketService.outputTypes().findIndex((t) => t.id == deviceAction.outputTypeId),
		}
		this.editingDeviceAction = true
	}

	public saveDeviceAction() {
		const outputTypeIdx = this.currentDeviceAction.outputTypeIdx
		if (outputTypeIdx === undefined || outputTypeIdx === -1 || !this.socketService.outputTypes()[outputTypeIdx]) {
			Swal.fire({ icon: 'error', text: 'Please select an output type!', title: 'Error', ...globalSwalOptions })
			return
		}

		this.editingDeviceAction = false
		const deviceActionObj = {
			// the spread intentionally overrides deviceId when editing an existing row
			// @ts-ignore
			deviceId: this.device.id,
			...this.currentDeviceAction,
			outputTypeId: this.socketService.outputTypes()[outputTypeIdx].id,
		} as DeviceAction

		this.socketService.socket.emit('manage', {
			action: deviceActionObj.id !== undefined ? 'edit' : 'add',
			type: 'device_action',
			device_action: deviceActionObj,
		})
	}

	public duplicateDeviceAction(deviceAction: DeviceAction) {
		this.socketService.socket.emit('manage', {
			action: 'duplicate',
			type: 'device_action',
			device_action: { id: deviceAction.id },
		})
	}

	@Confirmable('Are you sure you want to delete this action?')
	public deleteDeviceAction(deviceAction: DeviceAction) {
		this.socketService.socket.emit('manage', {
			action: 'delete',
			type: 'device_action',
			device_action: { id: deviceAction.id },
		})
	}
}
