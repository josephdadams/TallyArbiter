import { ComponentFixture, TestBed } from '@angular/core/testing'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

import { MIN_PASSWORD_LENGTH } from '../../../../../../../src/_helpers/passwordPolicy'
import { User } from 'src/app/_models/User'
import { AuthService } from 'src/app/_services/auth.service'
import { SocketService } from 'src/app/_services/socket.service'
import { SocketServiceStub } from 'src/app/_testing/socket-service.stub'
import { UserModalComponent } from './user-modal.component'

describe('UserModalComponent', () => {
	let fixture: ComponentFixture<UserModalComponent>
	let component: UserModalComponent
	let socketService: SocketServiceStub

	beforeEach(async () => {
		socketService = new SocketServiceStub()

		await TestBed.configureTestingModule({
			imports: [UserModalComponent],
			providers: [
				{ provide: SocketService, useValue: socketService },
				{ provide: AuthService, useValue: { roles: ['admin', 'producer', 'tally_view'] } },
				{ provide: NgbActiveModal, useValue: { close: () => {}, dismiss: () => {} } },
			],
		}).compileComponents()

		fixture = TestBed.createComponent(UserModalComponent)
		component = fixture.componentInstance
	})

	function createFor(user: Partial<User>, editing = false) {
		component.user = user as User
		component.editing = editing
		fixture.detectChanges()
	}

	it('requires a username and a password when adding', () => {
		createFor({})

		expect(component.form.controls.username.errors).toEqual({ required: true })
		expect(component.form.controls.password!.errors).toEqual({ required: true })
	})

	it('rejects a password shorter than the policy allows and says so inline', () => {
		createFor({})
		component.form.controls.password!.setValue('a'.repeat(MIN_PASSWORD_LENGTH - 1))
		component.form.controls.password!.markAsTouched()
		fixture.detectChanges()

		expect(component.form.invalid).toBe(true)
		expect(fixture.nativeElement.textContent).toContain(`at least ${MIN_PASSWORD_LENGTH} characters long`)
		expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true)
	})

	it('has no password control when editing, so an existing user saves untouched', () => {
		createFor({ username: 'jo', roles: 'admin' }, true)

		expect(component.form.controls.password).toBeUndefined()
		expect(component.form.valid).toBe(true)
	})

	it('locks the username while editing but still sends it', () => {
		createFor({ username: 'jo', roles: 'admin' }, true)
		expect(component.form.controls.username.disabled).toBe(true)

		component.save()

		expect(socketService.lastEmit('manage')!.args[0].user.username).toBe('jo')
	})

	it('joins the selected roles back into the semicolon-separated string', () => {
		createFor({ username: 'jo', roles: 'admin;producer' }, true)
		expect(component.form.controls.roles.value).toEqual(['admin', 'producer'])

		component.form.controls.roles.setValue(['producer', 'tally_view'])
		component.save()

		expect(socketService.lastEmit('manage')!.args[0].user.roles).toBe('producer;tally_view')
	})

	it('falls back to tally_view when no role is picked', () => {
		createFor({ username: 'jo' }, true)
		component.save()

		expect(socketService.lastEmit('manage')!.args[0].user.roles).toBe('tally_view')
	})

	it('does not emit while the form is invalid', () => {
		createFor({})
		component.save()

		expect(socketService.lastEmit('manage')).toBeUndefined()
	})

	it('emits an add once username and password pass', () => {
		createFor({})
		component.form.controls.username.setValue('newbie')
		component.form.controls.password!.setValue('a'.repeat(MIN_PASSWORD_LENGTH))
		component.save()

		const payload = socketService.lastEmit('manage')!.args[0]
		expect(payload.action).toBe('add')
		expect(payload.user.username).toBe('newbie')
		expect(payload.user.password.length).toBe(MIN_PASSWORD_LENGTH)
	})
})
