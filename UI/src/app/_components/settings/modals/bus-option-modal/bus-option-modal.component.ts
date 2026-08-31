import { Component, ChangeDetectionStrategy, Input, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { BusOption } from 'src/app/_models/BusOption'
import { SocketService } from 'src/app/_services/socket.service'

@Component({
	selector: 'app-bus-option-modal',
	standalone: true,
	imports: [FormsModule],
	templateUrl: './bus-option-modal.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['../../settings.component.scss'],
})
export class BusOptionModalComponent {
	public readonly activeModal = inject(NgbActiveModal)
	private readonly socketService = inject(SocketService)

	@Input() busOption: BusOption = {} as BusOption
	@Input() editing = false

	public save() {
		this.socketService.socket.emit('manage', {
			action: this.editing ? 'edit' : 'add',
			type: 'bus_option',
			busOption: { ...this.busOption } as any,
		})
	}
}
