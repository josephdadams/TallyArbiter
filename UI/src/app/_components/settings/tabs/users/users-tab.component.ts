import { Component, ChangeDetectionStrategy, inject } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { Confirmable } from 'src/app/_decorators/confirmable.decorator'
import { User } from 'src/app/_models/User'
import { AuthService } from 'src/app/_services/auth.service'
import { SocketService } from 'src/app/_services/socket.service'
import { UserModalComponent } from '../../modals/user-modal/user-modal.component'

@Component({
	selector: 'app-users-tab',
	standalone: true,
	imports: [],
	templateUrl: './users-tab.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersTabComponent {
	private readonly modalService = inject(NgbModal)
	public readonly authService = inject(AuthService)
	public readonly socketService = inject(SocketService)

	constructor() {
		this.socketService.socket.emit('users')
		this.socketService.socket.emit('default_password_users')
	}

	public addUser() {
		const ref = this.modalService.open(UserModalComponent)
		ref.componentInstance.user = {} as User
		ref.componentInstance.editing = false
	}

	public editUser(user: User) {
		const ref = this.modalService.open(UserModalComponent)
		ref.componentInstance.user = user
		ref.componentInstance.editing = true
	}

	public deleteUserButton(user: User) {
		if (this.authService.profile().username === user.username) {
			this.deleteUserAndLogout(user)
		} else {
			this.deleteUser(user)
		}
	}

	@Confirmable('Are you sure you want to delete this user?')
	public deleteUser(user: User) {
		this.socketService.socket.emit('manage', { action: 'delete', type: 'user', user })
	}

	@Confirmable(
		"You are logged in using this user. Are you sure you want to delete it? You'll be disconnected from this account and redirected to the login page.",
	)
	public deleteUserAndLogout(user: User) {
		this.socketService.socket.emit('manage', { action: 'delete', type: 'user', user })
		this.authService.logout(['login', 'settings'])
	}
}
