import { Component, OnInit, ChangeDetectionStrategy, Input, inject } from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { MIN_PASSWORD_LENGTH } from '../../../../../../../src/_helpers/passwordPolicy'
import { FormErrorComponent } from 'src/app/_forms/form-error.component'
import { nonBlank } from 'src/app/_forms/validators'
import { User } from 'src/app/_models/User'
import { AuthService } from 'src/app/_services/auth.service'
import { SocketService } from 'src/app/_services/socket.service'

@Component({
	selector: 'app-user-modal',
	standalone: true,
	imports: [ReactiveFormsModule, FormErrorComponent],
	templateUrl: './user-modal.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserModalComponent implements OnInit {
	public readonly activeModal = inject(NgbActiveModal)
	public readonly authService = inject(AuthService)
	private readonly socketService = inject(SocketService)

	/** the user being edited; a blank object when adding */
	@Input() user: User = {} as User
	@Input() editing = false

	public readonly minPasswordLength = MIN_PASSWORD_LENGTH

	public form!: FormGroup<{
		username: FormControl<string>
		roles: FormControl<string[]>
		password: FormControl<string>
	}>

	public ngOnInit() {
		//a new user needs a real password. this used to fall back to '12345', which quietly
		//created accounts on the password Tally Arbiter ships with. an existing user already
		//has one, so a blank field there means 'keep it' -- minLength alone passes an empty
		//value, so the length is only enforced on a password actually being set.
		const passwordValidators = this.editing
			? [Validators.minLength(MIN_PASSWORD_LENGTH)]
			: [nonBlank, Validators.minLength(MIN_PASSWORD_LENGTH)]

		this.form = new FormGroup<{
			username: FormControl<string>
			roles: FormControl<string[]>
			password: FormControl<string>
		}>({
			username: new FormControl(
				{ value: this.user.username ?? '', disabled: this.editing },
				{ nonNullable: true, validators: [nonBlank] },
			),
			roles: new FormControl(this.user.roles ? this.user.roles.split(';') : [], { nonNullable: true }),
			password: new FormControl('', { nonNullable: true, validators: passwordValidators }),
		})
	}

	public save() {
		if (this.form.invalid) return

		//getRawValue, not value: username is a disabled control while editing and the
		//server keys the update off it
		const { roles, password, ...rest } = this.form.getRawValue()
		const userObj = {
			...this.user,
			...rest,
			roles: roles.length > 0 ? roles.join(';') : 'tally_view',
		} as any

		//a blank field on an edit means 'leave the password alone', so send nothing at all
		//rather than an empty one
		if (password) {
			userObj.password = password
		} else {
			delete userObj.password
		}

		this.socketService.socket.emit('manage', {
			action: this.editing ? 'edit' : 'add',
			type: 'user',
			user: userObj,
		})
	}
}
