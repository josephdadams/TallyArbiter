import { Component, OnDestroy, ChangeDetectionStrategy, computed, effect, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { Subscription } from 'rxjs'
import { BusOption } from 'src/app/_models/BusOption'
import { NavbarVisibilityService } from 'src/app/_services/navbar-visibility.service'
import { SocketService } from 'src/app/_services/socket.service'
import { contrastColor } from 'src/app/_helpers/color'
import { ChatComponent } from '../chat/chat.component'

@Component({
	selector: 'app-tally',
	standalone: true,
	imports: [FormsModule, RouterLink, ChatComponent],
	templateUrl: './tally.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['./tally.component.scss'],
})
export class TallyComponent implements OnDestroy {
	public readonly route = inject(ActivatedRoute)
	public readonly socketService = inject(SocketService)
	private readonly navbarVisibilityService = inject(NavbarVisibilityService)

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

	//A frozen colour is indistinguishable from a correct one, and someone reads
	//this to decide whether they are on air. When the socket is down the screen
	//has to stop asserting anything.
	public readonly stale = computed(() => !this.socketService.connected())

	//The state has to be readable without relying on colour alone — on camera the
	//operator may be colour blind, and a phone in bright sun washes hues out.
	public readonly busLabel = computed(() =>
		this.stale() ? 'NO CONNECTION' : (this.currentBus()?.label?.toUpperCase() ?? 'STANDBY'),
	)

	public readonly background = computed(() => this.currentBus()?.color || 'var(--ta-tally-idle-bg)')

	//the idle background is always dark, so undefined resolves to white; while
	//stale the scrim covers the colour, so white always wins
	public readonly foreground = computed(() => (this.stale() ? '#ffffff' : contrastColor(this.currentBus()?.color)))

	public readonly isFullscreen = signal(false)
	public enableChatOptions = true

	private readonly supportsVibrate = 'vibrate' in navigator
	private routeSubscription?: Subscription

	private fullscreenChangeHandler = () => this.isFullscreen.set(document.fullscreenElement !== null)

	private reassignHandler = (oldDeviceId: string, deviceId: string) => {
		this.socketService.socket.emit('listener_reassign', oldDeviceId, deviceId)
		this.currentDeviceIdx.set(this.socketService.devices().findIndex((d) => d.id === deviceId))
	}

	constructor() {
		this.socketService.socket.emit('devices')
		this.socketService.socket.emit('bus_options')

		//A tally light is the whole screen. Once a device is picked the app chrome
		//is just 56px of black stealing contrast from the thing being looked at.
		effect(() => {
			if (this.currentDevice()) {
				this.navbarVisibilityService.hideNavbar()
			} else {
				this.navbarVisibilityService.showNavbar()
			}
		})

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

		document.addEventListener('fullscreenchange', this.fullscreenChangeHandler)

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

	//`chat=false` is carried on the link so the choice survives the navigation
	public chatQueryParams() {
		return this.enableChatOptions ? {} : { chat: 'false' }
	}

	public async toggleFullscreen() {
		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen()
			} else {
				await document.documentElement.requestFullscreen()
			}
		} catch {
			//iOS Safari refuses requestFullscreen outside of video; the page is
			//already chrome-free, so there is nothing to fall back to
		}
	}

	public ngOnDestroy() {
		this.socketService.socket.off('flash')
		this.socketService.socket.off('reassign', this.reassignHandler)
		document.removeEventListener('fullscreenchange', this.fullscreenChangeHandler)
		this.routeSubscription?.unsubscribe()
		this.navbarVisibilityService.showNavbar()
	}
}
