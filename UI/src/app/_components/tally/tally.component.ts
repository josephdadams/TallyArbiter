import { CommonModule } from '@angular/common'
import { Component } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { BusOption } from 'src/app/_models/BusOption'
import { SocketService } from 'src/app/_services/socket.service'
import { ChatComponent } from '../chat/chat.component'

@Component({
	selector: 'app-tally',
	standalone: true,
	imports: [CommonModule, FormsModule, ChatComponent],
	templateUrl: './tally.component.html',
	styleUrls: ['./tally.component.scss'],
})
export class TallyComponent {
	public currentDeviceIdx?: number
	public currentBus?: BusOption
	private supportsVibrate?: boolean = false

	public COLORS = {
		DARK_GREY: '#212529',
	}

	public enableChatOptions = true

	constructor(
		private router: Router,
		public route: ActivatedRoute,
		public socketService: SocketService,
	) {
		this.socketService.socket.emit('devices')
		this.socketService.socket.emit('bus_options')

		if ('vibrate' in navigator) {
			this.supportsVibrate = true
		}

		this.socketService.dataLoaded.then(() => {
			this.route.params.subscribe((params) => {
				if (params.deviceId) {
					this.currentDeviceIdx = this.socketService.devices.findIndex(
						(d) => d.id === params.deviceId || d.name === params.deviceId,
					)

					if (this.currentDeviceIdx === -1) return

					this.socketService.socket.emit('listenerclient_connect', {
						deviceId: this.socketService.devices[this.currentDeviceIdx].id,
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

		this.socketService.deviceStateChanged.subscribe((deviceStates) => {
			if (this.currentDeviceIdx === undefined) return

			const currentDevice = this.socketService.devices[this.currentDeviceIdx]
			if (!currentDevice) return

			const hightestPriorityBus = deviceStates
				.filter((d) => d.deviceId == currentDevice.id && d.sources.length > 0)
				.map(({ busId }) => this.socketService.busOptions.find((b) => b.id == busId))
				.reduce((a: any, b: any) => (a?.priority > b?.priority ? a : b), {}) as BusOption

			if (!hightestPriorityBus || Object.entries(hightestPriorityBus).length == 0) {
				this.currentBus = undefined
				return
			}

			if (hightestPriorityBus.type == 'program') {
				if (this.supportsVibrate) {
					window.navigator.vibrate(400)
				}
			} else if (hightestPriorityBus.type == 'preview') {
				if (this.supportsVibrate) {
					window.navigator.vibrate([100, 30, 100, 30, 100])
				}
			}

			this.currentBus = hightestPriorityBus
		})

		this.socketService.socket.on('reassign', (oldDeviceId: string, deviceId: string) => {
			this.socketService.socket.emit('listener_reassign', oldDeviceId, deviceId)
			this.currentDeviceIdx = this.socketService.devices.findIndex((d) => d.id === deviceId)
		})
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
	}
}