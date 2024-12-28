import { Component } from '@angular/core'
import { WakeLockService } from './_services/wake-lock.service'
import { NavbarVisibilityService } from './_services/navbar-visibility.service'
import { connLostSnackbarService } from './_services/conn-lost-snackbar.service'
import { LocationBackService } from 'src/app/_services/locationBack.service'
import { DarkModeService } from './_services/darkmode.service'
import { AuthService } from './_services/auth.service'

import { trigger, transition, style, animate, state } from '@angular/animations'

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss'],
	animations: [
		trigger('fade', [
			state(
				'hidden',
				style({
					opacity: 0,
				}),
			),
			state(
				'show',
				style({
					opacity: 1,
				}),
			),
			transition('hidden => show', [animate('0.2s')]),
			transition('show => hidden', [animate('0.2s')]),
		]),
	],
})
export class AppComponent {
	public showMenu = false

	constructor(
		private wakeLockService: WakeLockService,
		public navbarVisibilityService: NavbarVisibilityService,
		public connLostSnackbar: connLostSnackbarService,
		private locationBackService: LocationBackService,
		public darkModeService: DarkModeService,
		public authService: AuthService,
	) {
		wakeLockService.init()
		darkModeService.init()
	}
}
