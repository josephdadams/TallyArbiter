import { Component, ElementRef, ViewChild, ChangeDetectionStrategy, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, LoginResponse } from 'src/app/_services/auth.service'

@Component({
	selector: 'app-login',
	standalone: true,
	imports: [FormsModule],
	templateUrl: './login.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
	public readonly route = inject(ActivatedRoute)
	private readonly router = inject(Router)
	private readonly authService = inject(AuthService)

	//written from a promise callback, so they have to notify rather than be mutated
	public readonly loading = signal(false)
	public readonly loginResponse = signal<LoginResponse>({ loginOk: false, message: '', accessToken: '' })
	public username = ''
	public password = ''
	private redirectParam = ''
	private extraParam = ''
	@ViewChild('inputPassword') public inputPassword!: ElementRef

	constructor() {
		this.route.params.subscribe((params) => {
			if (params.redirect) this.redirectParam = params.redirect
			if (params.extraParam) this.extraParam = params.extraParam
		})

		switch (this.redirectParam) {
			case 'producer':
			case 'errors':
			case 'settings':
				break
			default:
				this.redirectParam = 'home'
				this.extraParam = ''
				break
		}
	}

	login(): void {
		this.loading.set(true)
		this.authService.login(this.username, this.password).then((response: LoginResponse) => {
			this.loginResponse.set(response)
			this.loading.set(false)

			if (response.loginOk === true) {
				if (this.authService.mustChangePassword) {
					//'home' is not guarded, so the guard alone would not catch this
					this.router.navigate(['change-password', this.redirectParam])
					return
				}
				let navigateParams = [this.redirectParam]
				if (this.extraParam !== '') navigateParams.push(this.extraParam)
				this.router.navigate(navigateParams)
			}
		})
	}
}
