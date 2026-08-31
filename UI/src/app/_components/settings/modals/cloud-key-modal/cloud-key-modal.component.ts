import { Component, ChangeDetectionStrategy, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { SocketService } from 'src/app/_services/socket.service'

@Component({
	selector: 'app-cloud-key-modal',
	standalone: true,
	imports: [FormsModule],
	templateUrl: './cloud-key-modal.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CloudKeyModalComponent {
	public readonly activeModal = inject(NgbActiveModal)
	private readonly socketService = inject(SocketService)

	public newCloudKey = ''

	public save() {
		this.socketService.socket.emit('manage', {
			action: 'add',
			type: 'cloud_key',
			key: this.newCloudKey,
		})
		this.activeModal.close()
	}
}
