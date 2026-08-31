import { Component, ChangeDetectionStrategy, Input, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { Device } from 'src/app/_models/Device'
import { SocketService } from 'src/app/_services/socket.service'

@Component({
	selector: 'app-device-modal',
	standalone: true,
	imports: [FormsModule],
	templateUrl: './device-modal.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['../../settings.component.scss'],
})
export class DeviceModalComponent {
	public readonly activeModal = inject(NgbActiveModal)
	public readonly socketService = inject(SocketService)

	@Input() device: Device = {} as Device
	@Input() editing = false

	public save() {
		const deviceObj = { ...this.device } as Device
		if (!this.editing) {
			deviceObj.enabled = true
		}

		//TSL addresses are a single byte with 126 reserved as the ceiling
		if (parseInt(deviceObj.tslAddress) > 126) {
			deviceObj.tslAddress = '126'
		} else if (parseInt(deviceObj.tslAddress) < 0) {
			deviceObj.tslAddress = ''
		}

		this.socketService.socket.emit('manage', {
			action: this.editing ? 'edit' : 'add',
			type: 'device',
			device: deviceObj,
		})
	}
}
