import { Component, OnDestroy, ChangeDetectionStrategy, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { Confirmable } from 'src/app/_decorators/confirmable.decorator'
import { SocketService } from 'src/app/_services/socket.service'
import { ErrorReportsListElement } from 'src/app/_models/ErrorReportsListElement'
import { NavbarVisibilityService } from 'src/app/_services/navbar-visibility.service'
import { LocationBackService } from 'src/app/_services/locationBack.service'

@Component({
	selector: 'app-error-reports-list',
	standalone: true,
	imports: [FormsModule],
	templateUrl: './error-reports-list.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['./error-reports-list.component.scss'],
})
export class ErrorReportsListComponent implements OnDestroy {
	private readonly router = inject(Router)
	public readonly socketService = inject(SocketService)
	public readonly navbarVisibilityService = inject(NavbarVisibilityService)
	public readonly locationBackService = inject(LocationBackService)

	//written from a socket handler, so they have to notify rather than be mutated
	public readonly unread_error_reports = signal<string[]>([])
	public readonly errorReportsLoaded = signal(false)

	private unreadErrorReportsHandler = (list: ErrorReportsListElement[]) => {
		this.unread_error_reports.set(list.map((report) => report.id))
		this.errorReportsLoaded.set(true)
	}

	constructor() {
		this.socketService.socket.on('unread_error_reports', this.unreadErrorReportsHandler)
		this.socketService.socket.emit('get_unread_error_reports')
	}

	public selectErrorReport(id: any) {
		this.router.navigate(['/', 'errors', id.target.value])
	}

	public markErrorReportsAsRead() {
		this.socketService.socket.emit('mark_error_reports_as_read')
	}

	@Confirmable('Are you sure you want to delete all error reports? This can not be undone.')
	public deleteEveryErrorReport() {
		this.socketService.socket.emit('delete_every_error_report')
	}

	ngOnDestroy(): void {
		this.socketService.socket.off('unread_error_reports', this.unreadErrorReportsHandler)
	}
}
