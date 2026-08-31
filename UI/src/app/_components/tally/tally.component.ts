import { Component, OnDestroy, ChangeDetectionStrategy, computed, effect, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { Subscription } from 'rxjs'
import { BusOption } from 'src/app/_models/BusOption'
import { SocketService } from 'src/app/_services/socket.service'
import { ChatComponent } from '../chat/chat.component'

@Component({
	selector: 'app-tally',
	standalone: true,
	imports: [FormsModule, ChatComponent],
	templateUrl: './tally.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['./tally.component.scss'],
})
export class TallyComponent implements OnDestroy {
	private readonly router = inject(Router)
	public readonly route = inject(ActivatedRoute)
	public readonly socketService = inject(SocketService)

	public readonly currentDeviceIdx = signal<number | undefined>(undefined)

	public readonly currentDevice = computed(() => {
		const idx = this.currentDeviceIdx()
		return idx === undefined ? undefined : this.socketService.devices()[idx]
	})

	//Which bus this device is on, if any. Derived rather than assigned from a
	//subscription: this is the whole screen, and it has to repaint whenever any of
	//its three inputs changes, not only when a device_states message happens to
	//arrive.
	public readonly currentBus = computed<BusOption | undefined>(() => {
		const device = this.currentDevice()
		if (!device) return undefined

		const busOptions = this.socketService.busOptions()
		return this.socketService
			.device_states()
			.filter((d) => d.deviceId == device.id && d.sources.length > 0)
			.map(({ busId }) => busOptions.find((b) => b.id == busId))
			.reduce<BusOption | undefined>((a, b) => ((a?.priority ?? -1) > (b?.priority ?? -1) ? a : b), undefined)
	})

	/** Fallback for "not on any bus" — see --ta-tally-idle-bg in styles/_tokens.scss. */
	public COLORS = {
		DARK_GREY: 'var(--ta-tally-idle-bg)',
	}

	public enableChatOptions = true

	private readonly supportsVibrate = 'vibrate' in navigator
	private routeSubscription?: Subscription

	private reassignHandler = (oldDeviceId: string, deviceId: string) => {
		this.socketService.socket.emit('listener_reassign', oldDeviceId, deviceId)
		this.currentDeviceIdx.set(this.socketService.devices().findIndex((d) => d.id === deviceId))
	}

	constructor() {
		this.socketService.socket.emit('devices')
		this.socketService.socket.emit('bus_options')

		//Buzz the phone in the operator's pocket when the bus changes. A side
		//effect, so it stays out of the derivation above.
		effect(() => {
			const bus = this.currentBus()
			if (!bus || !this.supportsVibrate) return

			if (bus.type == 'program') {
				window.navigator.vibrate(400)
			} else if (bus.type == 'preview') {
				window.navigator.vibrate([100, 30, 100, 30, 100])
			}
		})

		this.socketService.dataLoaded.then(() => {
			this.routeSubscription = this.route.params.subscribe((params) => {
				if (params.deviceId) {
					const idx = this.socketService
						.devices()
						.findIndex((d) => d.id === params.deviceId || d.name === params.deviceId)

					if (idx === -1) return
					this.currentDeviceIdx.set(idx)

					this.socketService.socket.emit('listenerclient_connect', {
						deviceId: this.socketService.devices()[idx].id,
						listenerType: 'web',
						canBeReassigned: true,
						canBeFlashed: true,
						supportsChat: true,
					})
				}
			})
		})

		this.socketService.socket.on('flash', function () {
			document.body.classList.add('flash')
			setTimeout(function () {
				document.body.classList.remove('flash')
			}, 500)
		})

		this.socketService.socket.on('reassign', this.reassignHandler)
	}

	public selectDevice(id: any) {
		let navUrl = `/tally/${id.target.value}`

		if (this.enableChatOptions) {
			this.router.navigate([navUrl])
		} else {
			this.router.navigate([navUrl], {
				queryParams: {
					chat: 'false',
				},
			})
		}
	}

	public ngOnDestroy() {
		this.socketService.socket.off('flash')
		this.socketService.socket.off('reassign', this.reassignHandler)
		this.routeSubscription?.unsubscribe()
	}
}
