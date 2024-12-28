import { Component } from '@angular/core'
import { SocketService } from 'src/app/_services/socket.service'

@Component({
	selector: 'app-producer',
	templateUrl: './producer.component.html',
	styleUrls: ['./producer.component.scss'],
})
export class ProducerComponent {
	public deviceBusColors: Record<string, string[]> = {}
	constructor(public socketService: SocketService) {
		this.socketService.joinProducers()
		this.socketService.dataLoaded
		this.socketService.deviceStateChanged.subscribe((deviceStates) => {
			for (const device of this.socketService.devices) {
				this.deviceBusColors[device.id] = deviceStates
					.filter((d) => d.deviceId == device.id && d.sources.length > 0)
					.map((d) => d.busId)
			}
		})
	}
}
