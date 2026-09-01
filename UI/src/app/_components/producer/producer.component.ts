import { DatePipe } from '@angular/common'
import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { BusOption } from 'src/app/_models/BusOption'
import { Device } from 'src/app/_models/Device'
import { contrastColor } from 'src/app/_helpers/color'
import { SocketService } from 'src/app/_services/socket.service'
import { ChatComponent } from '../chat/chat.component'

interface DeviceStatus {
	device: Device
	busses: BusOption[]
	live: boolean
}

@Component({
	selector: 'app-producer',
	standalone: true,
	imports: [DatePipe, FormsModule, RouterLink, ChatComponent],
	templateUrl: './producer.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['./producer.component.scss'],
})
export class ProducerComponent {
	public readonly socketService = inject(SocketService)

	public readonly filter = signal('')

	/**
	 * One row per device with the busses it is currently on already resolved.
	 * The old table rendered a cell per bus per device — at 80 devices and ten
	 * busses that is 800 cells whose only content is a colour, and no way to find
	 * a camera by name.
	 */
	public readonly statuses = computed<DeviceStatus[]>(() => {
		const deviceStates = this.socketService.device_states()
		const busOptions = this.socketService.busOptionsVisible()

		return this.socketService.devices().map((device) => {
			const busses = deviceStates
				.filter((d) => d.deviceId == device.id && d.sources.length > 0)
				.map(({ busId }) => busOptions.find((b) => b.id == busId))
				.filter((b): b is BusOption => b !== undefined)
				.sort((a, b) => b.priority - a.priority)

			return { device, busses, live: busses.some((b) => b.type === 'program') }
		})
	})

	public readonly visibleStatuses = computed(() => {
		const needle = this.filter().trim().toLowerCase()
		if (!needle) return this.statuses()

		return this.statuses().filter(
			({ device }) => device.name?.toLowerCase().includes(needle) || device.description?.toLowerCase().includes(needle),
		)
	})

	public readonly liveCount = computed(() => this.statuses().filter((s) => s.live).length)

	public readonly contrastColor = contrastColor

	constructor() {
		this.socketService.joinProducers()
	}

	public clearFilter() {
		this.filter.set('')
	}
}
