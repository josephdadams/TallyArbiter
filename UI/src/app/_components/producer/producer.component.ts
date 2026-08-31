import { DatePipe } from '@angular/common'
import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core'
import { ChatComponent } from '../chat/chat.component'
import { SocketService } from 'src/app/_services/socket.service'

@Component({
	selector: 'app-producer',
	standalone: true,
	imports: [DatePipe, ChatComponent],
	templateUrl: './producer.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['./producer.component.scss'],
})
export class ProducerComponent {
	public readonly socketService = inject(SocketService)

	//Which busses each device is currently on. Derived from the two signals it
	//reads, which replaces a deviceStateChanged subscription that could only
	//react to state messages — a device list arriving afterwards left this stale.
	public readonly deviceBusColors = computed<Record<string, string[]>>(() => {
		const deviceStates = this.socketService.device_states()
		const busIdsByDevice: Record<string, string[]> = {}

		for (const device of this.socketService.devices()) {
			busIdsByDevice[device.id] = deviceStates
				.filter((d) => d.deviceId == device.id && d.sources.length > 0)
				.map((d) => d.busId)
		}

		return busIdsByDevice
	})

	constructor() {
		this.socketService.joinProducers()
	}
}
