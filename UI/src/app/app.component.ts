import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core'
import { RouterModule } from '@angular/router'
import { trigger, transition, style, animate, state } from '@angular/animations'

import { WakeLockService } from './_services/wake-lock.service'
import { NavbarVisibilityService } from './_services/navbar-visibility.service'
import { LocationBackService } from 'src/app/_services/locationBack.service'
import { DarkModeService } from './_services/darkmode.service'
import { AuthService } from './_services/auth.service'
import { SocketService } from './_services/socket.service'
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
	private readonly locationBackService = inject(LocationBackService)
	public readonly darkModeService = inject(DarkModeService)
	public readonly authService = inject(AuthService)
	public readonly socketService = inject(SocketService)

	public readonly showMenu = signal(false)

	//A source going down freezes every device it feeds, so it has to be visible
	//from wherever the user happens to be, not only from the settings tab that
	//owns it.
	public readonly disconnectedSourceNames = computed(() => {
		const names = this.socketService.disconnectedSources().map((source) => source.name)
		return names.length ? `Not connected: ${names.join(', ')}` : ''
	})

	constructor() {
		const wakeLockService = this.wakeLockService
		const darkModeService = this.darkModeService

		wakeLockService.init()
		darkModeService.init()
	}
}
