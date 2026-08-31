import { Component, ChangeDetectionStrategy, EventEmitter, Input, Output, computed, inject } from '@angular/core'
import { Device } from 'src/app/_models/Device'
import { SocketService } from 'src/app/_services/socket.service'

/**
 * The device grid, shared by the Sources & Devices tab (editable) and the
 * Testing tab (read-only). Presentational: it renders bus state and emits row
 * actions, so the Testing tab doesn't pull in any of the editing machinery.
 */
@Component({
	selector: 'app-devices-table',
	standalone: true,
	imports: [],
	templateUrl: './devices-table.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['./devices-table.component.scss'],
})
export class DevicesTableComponent {
	public readonly socketService = inject(SocketService)

	@Input() editMode = false

	@Output() addDevice = new EventEmitter<void>()
	@Output() editDevice = new EventEmitter<Device>()
	@Output() editSources = new EventEmitter<Device>()
	@Output() editActions = new EventEmitter<Device>()
	@Output() duplicateDevice = new EventEmitter<Device>()
	@Output() deleteDevice = new EventEmitter<Device>()

	/** which busses each device is currently on, keyed by device id */
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

	public readonly sourceCounts = computed<Record<string, number>>(() => this.countByDevice('deviceSources'))
	public readonly actionCounts = computed<Record<string, number>>(() => this.countByDevice('deviceActions'))

	private countByDevice(collection: 'deviceSources' | 'deviceActions'): Record<string, number> {
		const counts: Record<string, number> = {}
		for (const item of this.socketService[collection]()) {
			counts[item.deviceId] = (counts[item.deviceId] ?? 0) + 1
		}
		return counts
	}
}
