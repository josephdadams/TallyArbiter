import { Component, ChangeDetectionStrategy, OnDestroy, inject } from '@angular/core'
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { Subscription } from 'rxjs'
import { Confirmable } from 'src/app/_decorators/confirmable.decorator'
import { AuthService } from 'src/app/_services/auth.service'
import { SocketService } from 'src/app/_services/socket.service'

interface SettingsTab {
	path: string
	label: string
	/** omitted for tabs any settings user may open */
	role?: string
}

const TABS: SettingsTab[] = [
	{ path: 'sources-devices', label: 'Sources & Devices', role: 'settings:sources_devices' },
	{ path: 'listeners', label: 'Listeners', role: 'settings:listeners' },
	{ path: 'cloud', label: 'Cloud', role: 'settings:cloud' },
	{ path: 'testing', label: 'Testing', role: 'settings:testing' },
	{ path: 'config', label: 'Config', role: 'settings:config' },
	{ path: 'users', label: 'Users', role: 'settings:users' },
	{ path: 'logs', label: 'Logs' },
]

/**
 * Shell for the settings screen. Each tab is a routed child, so its code — and
 * for the config tab the JSON editor it drags in — only loads when someone
 * actually opens it.
 */
@Component({
	selector: 'app-settings',
	standalone: true,
	imports: [RouterLink, RouterLinkActive, RouterOutlet],
	templateUrl: './settings.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnDestroy {
	private readonly router = inject(Router)
	private readonly modalService = inject(NgbModal)
	private readonly authService = inject(AuthService)
	public readonly socketService = inject(SocketService)

	public readonly visibleTabs = TABS.filter((tab) => !tab.role || this.authService.requireRole(tab.role))

	private readonly subscriptions: Subscription[] = []

	//kept on the shell rather than a tab: the server can raise an error while the
	//user is on any of them, and dismissing modals has to work across tab changes
	private handleServerError = (id: string) => {
		this.router.navigate(['/errors', id])
	}

	private handleUnreadErrorReports = (list: any[]) => {
		if (list.length > 0) {
			this.showErrorsList()
		}
	}

	@Confirmable(`There are error reports that you haven't read yet. Do you want to open the list of errors now?`, false)
	public showErrorsList() {
		this.router.navigate(['/errors'])
	}

	constructor() {
		this.socketService.joinAdmins()
		this.subscriptions.push(this.socketService.closeModals.subscribe(() => this.modalService.dismissAll()))

		if (this.authService.requireRole('admin')) {
			this.socketService.socket.on('server_error', this.handleServerError)
			this.socketService.socket.on('unread_error_reports', this.handleUnreadErrorReports)
			this.socketService.socket.emit('get_unread_error_reports')
		}

		// Landing on /settings itself: send the user to the first tab they hold a
		// role for, rather than a fixed one they might not be allowed to see.
		if (
			this.router.url
				.replace(/[?#].*$/, '')
				.replace(/\/$/, '')
				.endsWith('/settings') &&
			this.visibleTabs.length
		) {
			this.router.navigate(['/settings', this.visibleTabs[0].path], { replaceUrl: true })
		}
	}

	public ngOnDestroy() {
		for (const subscription of this.subscriptions) {
			subscription.unsubscribe()
		}
		this.socketService.socket.off('server_error', this.handleServerError)
		this.socketService.socket.off('unread_error_reports', this.handleUnreadErrorReports)
	}
}
