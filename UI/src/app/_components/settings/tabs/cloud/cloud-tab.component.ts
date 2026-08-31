import { Component, ChangeDetectionStrategy, inject } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { Confirmable } from 'src/app/_decorators/confirmable.decorator'
import { CloudClient } from 'src/app/_models/CloudClient'
import { CloudDestination } from 'src/app/_models/CloudDestination'
import { SocketService } from 'src/app/_services/socket.service'
import { CloudDestinationModalComponent } from '../../modals/cloud-destination-modal/cloud-destination-modal.component'
import { CloudKeyModalComponent } from '../../modals/cloud-key-modal/cloud-key-modal.component'

@Component({
	selector: 'app-cloud-tab',
	standalone: true,
	imports: [],
	templateUrl: './cloud-tab.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CloudTabComponent {
	private readonly modalService = inject(NgbModal)
	public readonly socketService = inject(SocketService)

	public addCloudDestination() {
		const ref = this.modalService.open(CloudDestinationModalComponent)
		ref.componentInstance.cloudDestination = {} as CloudDestination
		ref.componentInstance.editing = false
	}

	public editCloudDestination(cloudDestination: CloudDestination) {
		const ref = this.modalService.open(CloudDestinationModalComponent)
		ref.componentInstance.cloudDestination = { ...cloudDestination } as CloudDestination
		ref.componentInstance.editing = true
	}

	@Confirmable('Are you sure you want to delete this Cloud Destination?')
	public deleteCloudDestination(cloudDestination: CloudDestination) {
		this.socketService.socket.emit('manage', {
			action: 'delete',
			type: 'cloud_destination',
			cloudId: cloudDestination.id,
		})
	}

	public disconnectCloudDestination(cloudDestination: CloudDestination) {
		this.socketService.socket.emit('cloud_destination_disconnect', cloudDestination.id)
	}

	public reconnectCloudDestination(cloudDestination: CloudDestination) {
		this.socketService.socket.emit('cloud_destination_reconnect', cloudDestination.id)
	}

	public addCloudKey() {
		this.modalService.open(CloudKeyModalComponent)
	}

	@Confirmable(
		'If you delete this key, all connected cloud clients using this key will be disconnected. Are you sure you want to delete it?',
	)
	public deleteCloudKey(key: string) {
		this.socketService.socket.emit('manage', { action: 'delete', type: 'cloud_key', key })
	}

	public removeCloudClient(client: CloudClient) {
		this.socketService.socket.emit('manage', { action: 'remove', type: 'cloud_client', id: client.id })
	}
}
