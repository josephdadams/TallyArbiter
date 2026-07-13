import { CommonModule } from '@angular/common'
import { Component, OnDestroy, OnInit } from '@angular/core'
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
	imports: [CommonModule, FormsModule],
	templateUrl: './error-reports-list.component.html',
	styleUrls: ['./error-reports-list.component.scss'],
})
export class ErrorReportsListComponent implements OnInit, OnDestroy {
	public unread_error_reports: any = []
	public errorReportsLoaded: boolean = false

	private unreadErrorReportsHandler = (list: ErrorReportsListElement[]) => {
		this.unread_error_reports = list.map((report) => report.id)
		this.errorReportsLoaded = true
	}

	constructor(
		private router: Router,
		public socketService: SocketService,
		public navbarVisibilityService: NavbarVisibilityService,
		public locationBackService: LocationBackService,
	) {
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

	ngOnInit(): void {}

	ngOnDestroy(): void {
		this.socketService.socket.off('unread_error_reports', this.unreadErrorReportsHandler)
	}
}
