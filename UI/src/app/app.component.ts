import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core'
import { RouterModule } from '@angular/router'
import { trigger, transition, style, animate, state } from '@angular/animations'

import { WakeLockService } from './_services/wake-lock.service'
import { NavbarVisibilityService } from './_services/navbar-visibility.service'
import { connLostSnackbarService } from './_services/conn-lost-snackbar.service'
import { LocationBackService } from 'src/app/_services/locationBack.service'
import { DarkModeService } from './_services/darkmode.service'
import { AuthService } from './_services/auth.service'
import { ThemeSelectorComponent } from './_components/theme-selector/theme-selector.component'

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [RouterModule, ThemeSelectorComponent],
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	animations: [
		trigger('fade', [
			state('hidden', style({ opacity: 0 })),
			state('show', style({ opacity: 1 })),
			transition('hidden => show', [animate('0.2s')]),
			transition('show => hidden', [animate('0.2s')]),
		]),
	],
})
export class AppComponent {
	private readonly wakeLockService = inject(WakeLockService)
	public readonly navbarVisibilityService = inject(NavbarVisibilityService)
	public readonly connLostSnackbar = inject(connLostSnackbarService)
	private readonly locationBackService = inject(LocationBackService)
	public readonly darkModeService = inject(DarkModeService)
	public readonly authService = inject(AuthService)

	public readonly showMenu = signal(false)

	constructor() {
		const wakeLockService = this.wakeLockService
		const darkModeService = this.darkModeService

		wakeLockService.init()
		darkModeService.init()
	}
}
