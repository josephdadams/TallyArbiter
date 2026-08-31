import { Component, ElementRef, ViewChild, ChangeDetectionStrategy, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, ChangePasswordResponse } from 'src/app/_services/auth.service'
import { MIN_PASSWORD_LENGTH } from '../../../../../src/_helpers/passwordPolicy'

@Component({
	selector: 'app-change-password',
	standalone: true,
	imports: [FormsModule],
	templateUrl: './change-password.component.html',
	changeDetection: ChangeDetectionStrategy.Eager,
	styleUrls: ['./change-password.component.scss'],
})
export class ChangePasswordComponent {
	public readonly route = inject(ActivatedRoute)
	private readonly router = inject(Router)
	public readonly authService = inject(AuthService)

	public loading = false
	public response: ChangePasswordResponse = { changeOk: true, message: '', accessToken: '' }
	public currentPassword = ''
	public newPassword = ''
	public confirmPassword = ''
	public minLength = MIN_PASSWORD_LENGTH
	private redirectParam = 'home'
	@ViewChild('inputNewPassword') public inputNewPassword!: ElementRef
	@ViewChild('inputConfirmPassword') public inputConfirmPassword!: ElementRef

	constructor() {
		this.route.params.subscribe((params) => {
			if (params.redirect) this.redirectParam = params.redirect
		})

		switch (this.redirectParam) {
			case 'producer':
			case 'errors':
			case 'settings':
				break
			default:
				this.redirectParam = 'home'
				break
		}
	}

	//true when this is the forced first-run change rather than a voluntary one
	public get forced(): boolean {
		return this.authService.mustChangePassword
	}

	public get username(): string {
		return this.authService.profile?.username || ''
	}

	public get validationError(): string {
		if (this.newPassword.length > 0 && this.newPassword.length < MIN_PASSWORD_LENGTH) {
			return `Your new password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
		}
		if (this.confirmPassword.length > 0 && this.newPassword !== this.confirmPassword) {
			return 'The two new passwords do not match.'
		}
		return ''
	}

	public get canSubmit(): boolean {
		return (
			!this.loading &&
			this.currentPassword.length > 0 &&
			this.newPassword.length >= MIN_PASSWORD_LENGTH &&
			this.newPassword === this.confirmPassword
		)
	}

	changePassword(): void {
		if (!this.canSubmit) return
		this.loading = true
		this.authService.changePassword(this.currentPassword, this.newPassword).then((response) => {
			this.response = response
			this.loading = false

			if (response.changeOk === true) {
				this.currentPassword = ''
				this.newPassword = ''
				this.confirmPassword = ''
				this.router.navigate([this.redirectParam])
			}
		})
	}
}
