import { Component, ChangeDetectionStrategy, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { Confirmable } from 'src/app/_decorators/confirmable.decorator'
import { ListenerClient } from 'src/app/_models/ListenerClient'
import { TSLClient } from 'src/app/_models/TSLClient'
import { SocketService } from 'src/app/_services/socket.service'
import {
	TslClientModalComponent,
	createDefaultTSLClient,
	normalizeTSLClient,
} from '../../modals/tsl-client-modal/tsl-client-modal.component'

@Component({
	selector: 'app-listeners-tab',
	standalone: true,
	imports: [FormsModule],
	templateUrl: './listeners-tab.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListenersTabComponent {
	private readonly modalService = inject(NgbModal)
	public readonly socketService = inject(SocketService)

	public reassignListenerClient(client: ListenerClient, newDeviceId: string) {
		this.socketService.socket.emit('reassign', client.id, client.deviceId, newDeviceId)
	}

	public deleteListener(listenerClient: ListenerClient) {
		this.socketService.socket.emit('listener_delete', listenerClient.id)
	}

	public flash(listenerClient: ListenerClient) {
		this.socketService.socket.emit('flash', listenerClient.id)
	}

	public addTSLClient() {
		const ref = this.modalService.open(TslClientModalComponent)
		ref.componentInstance.tslClient = createDefaultTSLClient() as TSLClient
		ref.componentInstance.editing = false
	}

	public editTSLClient(tslClient: TSLClient) {
		const ref = this.modalService.open(TslClientModalComponent)
		ref.componentInstance.tslClient = normalizeTSLClient({ ...tslClient }) as TSLClient
		ref.componentInstance.editing = true
	}

	@Confirmable('Are you sure you want to delete this TSL Client?')
	public deleteTSLClient(tslClient: TSLClient) {
		this.socketService.socket.emit('manage', {
			action: 'delete',
			type: 'tsl_client',
			tslClientId: tslClient.id,
		})
	}
}
