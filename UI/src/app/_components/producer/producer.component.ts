import { CommonModule } from '@angular/common'
import { Component, OnDestroy } from '@angular/core'
import { Subscription } from 'rxjs'
import { ChatComponent } from '../chat/chat.component'
import { SocketService } from 'src/app/_services/socket.service'

@Component({
	selector: 'app-producer',
	standalone: true,
	imports: [CommonModule, ChatComponent],
	templateUrl: './producer.component.html',
	styleUrls: ['./producer.component.scss'],
})
export class ProducerComponent implements OnDestroy {
	public deviceBusColors: Record<string, string[]> = {}

	private deviceStateChangedSubscription: Subscription

	constructor(public socketService: SocketService) {
		this.socketService.joinProducers()
		this.socketService.dataLoaded

		this.deviceStateChangedSubscription = this.socketService.deviceStateChanged.subscribe((deviceStates) => {
			for (const device of this.socketService.devices) {
				this.deviceBusColors[device.id] = deviceStates
					.filter((d) => d.deviceId == device.id && d.sources.length > 0)
					.map((d) => d.busId)
			}
		})
	}

	ngOnDestroy(): void {
		this.deviceStateChangedSubscription?.unsubscribe()
	}
}
