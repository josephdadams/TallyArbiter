import { Component, OnInit, OnDestroy, AfterViewInit, Renderer2, ElementRef } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { SocketService } from 'src/app/_services/socket.service'
import { ErrorReport } from 'src/app/_models/ErrorReport'
import { Confirmable } from 'src/app/_decorators/confirmable.decorator'
import { NavbarVisibilityService } from 'src/app/_services/navbar-visibility.service'
import { LocationBackService } from 'src/app/_services/locationBack.service'
import { versions } from 'src/environments/versions'

@Component({
	selector: 'app-error-report',
	templateUrl: './error-report.component.html',
	styleUrls: ['./error-report.component.scss'],
})
export class ErrorReportComponent implements OnInit, OnDestroy, AfterViewInit {
	public currentReportId: string = 'blank'
	public currentReport: ErrorReport = {} as ErrorReport
	public loading = true
	public validReport = false

	public bugReportUrl = ''
	public bugReportUrlLoaded: boolean = false
	public bugReportShowForkWarning: boolean = false

	constructor(
		public route: ActivatedRoute,
		public socketService: SocketService,
		public navbarVisibilityService: NavbarVisibilityService,
		public locationBackService: LocationBackService,
		private renderer: Renderer2,
		private el: ElementRef,
	) {
		navbarVisibilityService.hideNavbar()
		this.route.params.subscribe((params) => {
			if (params.errorReportId) {
				this.currentReportId = params.errorReportId
			}
		})
	}

	ngAfterViewInit() {
		this.renderer.setStyle(this.el.nativeElement.ownerDocument.body, 'background', '#3973aa')
	}

	checkIfIssuesEnabled(url: string) {
		/* @ts-ignore: All code paths resolve the promise */
		return new Promise<boolean>((resolve, reject) => {
			if (new URL(url).host !== 'github.com/') resolve(false)
			let repo = url.split('github.com/')[1].split('/', 2).join('/').toLowerCase()

			switch (repo) {
				case 'josephdadams/tallyarbiter':
					//assume that our repo has always issues enabled
					resolve(true)
					break

				default:
					fetch(`https://api.github.com/repos/${repo}`, { cache: 'no-store' })
						.then((response) => {
							response
								.json()
								.then((data) => {
									resolve(data.has_issues)
								})
								.catch(() => {
									resolve(false)
								})
						})
						.catch(() => {
							resolve(false)
						})
			}
		})
	}

	generateBugReportUrlParams(
		bugTitle: string,
		version: string,
		config: any,
		logs: string,
		stacktrace: string,
		runningRecursive: boolean = false,
	): string {
		//https://medium.com/@DylanAttal/truncate-a-string-in-javascript-41f33171d5a8
		function truncateString(str: string, num: number) {
			// If the length of str is less than or equal to num
			// just return str--don't truncate it.
			if (str.length <= num) {
				return str
			}
			// Return str truncated with '...' concatenated to the end of str.
			return str.slice(0, num) + '...'
		}

		let bugReportUrl: string = `/issues/new?labels=bug&template=bug.yaml&title=${encodeURIComponent(bugTitle)}&version=${version}&config=${encodeURIComponent(JSON.stringify(config, null, 2))}&logs=${encodeURIComponent(logs)}&stacktrace=${encodeURIComponent(stacktrace)}`
		if (bugReportUrl.length > 8140 && !runningRecursive) {
			bugTitle = truncateString(bugTitle, 60)
			let logs_split: string[] = logs.split('\n')
			if (logs_split.length > 10) {
				logs_split.splice(0, logs_split.length - 5)
				logs = logs_split.join('\n')
			}
			delete config.tsl_clients
			delete config.tsl_clients_1secupdate
			delete config.cloud_destinations
			delete config.cloud_keys
			bugReportUrl = this.generateBugReportUrlParams(bugTitle, version, config, logs, stacktrace, true)
		}
		if (bugReportUrl.length > 8140 && runningRecursive) {
			config = { error: 'config redacted since the issue url was too long' }
			bugReportUrl = this.generateBugReportUrlParams(bugTitle, version, config, logs, stacktrace, true)
		}
		return bugReportUrl
	}

	generateBugReportUrl(bugTitle: string, version: string, config: object, logs: string, stacktrace: string) {
		return new Promise<string>((resolve, reject) => {
			this.checkIfIssuesEnabled(versions.remote_url).then((issuesEnabled) => {
				let repo_url: string = ''
				if (issuesEnabled) {
					repo_url = versions.remote_url
				} else {
					repo_url = 'https://github.com/josephdadams/TallyArbiter'
					this.bugReportShowForkWarning = true
				}
				console.log(`Issues ${issuesEnabled ? 'enabled' : 'disabled'} for the repo ${repo_url}.`)
				resolve(`${repo_url}${this.generateBugReportUrlParams(bugTitle, version, config, logs, stacktrace)}`)
			})
		})
	}

	bugReportButtonClick() {
		if (this.bugReportShowForkWarning) {
			this.bugReportForkWarning()
		} else {
			open(this.bugReportUrl, '_blank')
		}
	}

	@Confirmable(
		"You are running an unofficial copy of TallyArbiter, AKA a fork. Note that doing this you can edit TallyArbiter source code and you can introuce new bugs that not exist in the official version. If you're a developer, and you know that this bug isn't related to your contribution, click 'Ok' to open a bug report on the official Github repository of TallyArbiter.",
		false,
		{ icon: 'warning', title: 'TallyArbiter fork detected' },
	)
	bugReportForkWarning() {
		this.bugReportUrl = this.bugReportUrl.replace('labels=bug', 'labels=bug,fork')
		open(this.bugReportUrl, '_blank')
	}

	ngOnInit() {
		this.socketService
			.getErrorReportById(this.currentReportId)
			.then((errorReport) => {
				this.currentReport = errorReport as ErrorReport
				this.loading = false
				this.validReport = true
				let bugTitle = '[Bug] ' + this.currentReport.stacktrace.split('\n')[0]
				this.generateBugReportUrl(
					bugTitle,
					this.socketService.version as string,
					this.currentReport.config,
					this.currentReport.logs,
					this.currentReport.stacktrace,
				).then((response) => {
					this.bugReportUrl = response
					this.bugReportUrlLoaded = true
				})
				console.log('Error report found:')
				console.log(errorReport)
			})
			.catch((response) => {
				this.loading = false
				console.log('Error report not found')
			})
	}

	ngOnDestroy() {
		this.renderer.removeStyle(this.el.nativeElement.ownerDocument.body, 'background')
		this.navbarVisibilityService.showNavbar()
	}
}
