import { Component, OnInit, ChangeDetectionStrategy, Input, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { MIN_PASSWORD_LENGTH } from '../../../../../../../src/_helpers/passwordPolicy'
import { User } from 'src/app/_models/User'
import { AuthService } from 'src/app/_services/auth.service'
import { SocketService } from 'src/app/_services/socket.service'

@Component({
	selector: 'app-user-modal',
	standalone: true,
	imports: [FormsModule],
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

	public selectedUserRoles: string[] = []
	public readonly minPasswordLength = MIN_PASSWORD_LENGTH

	public ngOnInit() {
		this.selectedUserRoles = this.user.roles ? this.user.roles.split(';') : []
	}

	public userRolesSelectionChange(selection: string[]) {
		this.user.roles = selection.join(';')
	}

	public isUserRoleSelected(role: string) {
		return !!this.user.roles && this.user.roles.split(';').includes(role)
	}

	//a new user needs a real password. this used to fall back to '12345', which quietly
	//created accounts on the password Tally Arbiter ships with.
	public get newUserPasswordError(): string {
		if (this.editing) return ''
		const password = this.user.password || ''
		if (password.length === 0) return 'Please set a password for this user.'
		if (password.length < MIN_PASSWORD_LENGTH) {
			return `The password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
		}
		return ''
	}

	public save() {
		if (this.newUserPasswordError !== '') return

		const userObj = { ...this.user } as any
		if (!userObj.roles) {
			userObj.roles = 'tally_view'
		}

		this.socketService.socket.emit('manage', {
			action: this.editing ? 'edit' : 'add',
			type: 'user',
			user: userObj,
		})
	}
}
