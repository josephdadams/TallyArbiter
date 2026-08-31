import { Component, ChangeDetectionStrategy, Input, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { CloudDestination } from 'src/app/_models/CloudDestination'
import { SocketService } from 'src/app/_services/socket.service'

@Component({
	selector: 'app-cloud-destination-modal',
	standalone: true,
	imports: [FormsModule],
	templateUrl: './cloud-destination-modal.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CloudDestinationModalComponent {
	public readonly activeModal = inject(NgbActiveModal)
	private readonly socketService = inject(SocketService)

	@Input() cloudDestination: CloudDestination = {} as CloudDestination
	@Input() editing = false

	public save() {
		this.socketService.socket.emit('manage', {
			action: this.editing ? 'edit' : 'add',
			type: 'cloud_destination',
			cloudDestination: { ...this.cloudDestination } as CloudDestination,
		})
	}
}
