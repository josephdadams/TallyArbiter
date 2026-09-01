import {
	Component,
	ChangeDetectionStrategy,
	ElementRef,
	OnDestroy,
	ViewChild,
	computed,
	inject,
	signal,
} from '@angular/core'
import { DatePipe } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { Subscription } from 'rxjs'
import { SweetAlertOptions } from 'sweetalert2'
import { Confirmable } from 'src/app/_decorators/confirmable.decorator'
import { SocketService } from 'src/app/_services/socket.service'

type LogLevel = { title: string; id: string }

const remoteErrorText: string = 'Remote error reporting helps us keep Tally Arbiter running smoothly.'

const optOutAlertOptions: SweetAlertOptions = {
	title: 'Are you sure?',
	text: remoteErrorText,
	showCancelButton: true,
	confirmButtonColor: '#2a70c7',
	icon: 'question',
	focusCancel: false,
}

const optInAlertOptions: SweetAlertOptions = {
	title: 'Thank you!',
	text: remoteErrorText,
	showCancelButton: false,
	confirmButtonColor: '#2a70c7',
	icon: 'success',
	focusCancel: false,
}

@Component({
	selector: 'app-logs-tab',
	standalone: true,
	imports: [DatePipe, FormsModule, RouterLink],
	templateUrl: './logs-tab.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['../../settings.component.scss'],
})
export class LogsTabComponent implements OnDestroy {
	public readonly socketService = inject(SocketService)

	@ViewChild('logsContainer') private logsContainer!: ElementRef
	@ViewChild('tallyDataContainer') private tallyDataContainer!: ElementRef

	public logLevels: LogLevel[] = [
		{ title: 'Error', id: 'error' },
		{ title: 'Console', id: 'console-action' },
		{ title: 'Info', id: 'info' },
		{ title: 'Verbose', id: 'info-quiet' },
	]
	public readonly currentLogLevel = signal('info')

	//derived rather than refiltered from a newLogsSubject subscription, so a level
	//change and an incoming log line both repaint the pane
	public readonly visibleLogs = computed(() => {
		const index = this.logLevels.findIndex((l) => l.id == this.currentLogLevel())
		const allowedLogLevels = this.logLevels.filter((l, i) => i <= index).map((l) => l.id)
		return this.socketService.logs().filter((l) => allowedLogLevels.includes(l.type))
	})

	private readonly subscriptions: Subscription[] = [
		this.socketService.newLogsSubject.subscribe(() => this.scrollToBottom(this.logsContainer)),
		this.socketService.scrollTallyDataSubject.subscribe(() => this.scrollToBottom(this.tallyDataContainer)),
	]

	public ngOnDestroy() {
		for (const subscription of this.subscriptions) {
			subscription.unsubscribe()
		}
	}

	public setLogLevel(logLevel: string) {
		this.currentLogLevel.set(logLevel)
		this.scrollToBottom(this.logsContainer)
	}

	@Confirmable(remoteErrorText, false, optOutAlertOptions)
	public optOutErrorReporting() {
		this.socketService.socket.emit('remote_error_opt', false)
	}

	@Confirmable(remoteErrorText, false, optInAlertOptions)
	public optInErrorReporting() {
		this.socketService.socket.emit('remote_error_opt', true)
	}

	private scrollToBottom(e: ElementRef) {
		setTimeout(() => {
			try {
				e.nativeElement.scrollTop = e.nativeElement.scrollHeight
			} catch {}
		})
	}
}
