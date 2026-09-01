import { ComponentFixture, TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'

import { AuthService } from 'src/app/_services/auth.service'
import { SocketService } from 'src/app/_services/socket.service'
import { SocketServiceStub } from 'src/app/_testing/socket-service.stub'
import { SettingsComponent } from './settings.component'

class AuthServiceStub {
	public granted: string[] = []
	public requireRole(role: string) {
		return this.granted.includes('admin') || this.granted.includes(role)
	}
}

describe('SettingsComponent', () => {
	let fixture: ComponentFixture<SettingsComponent>
	let authService: AuthServiceStub

	async function setup(roles: string[]) {
		authService = new AuthServiceStub()
		authService.granted = roles

		await TestBed.configureTestingModule({
			imports: [SettingsComponent],
			providers: [
				provideRouter([]),
				{ provide: SocketService, useValue: new SocketServiceStub() },
				{ provide: AuthService, useValue: authService },
			],
		}).compileComponents()

		fixture = TestBed.createComponent(SettingsComponent)
		fixture.detectChanges()
	}

	afterEach(() => TestBed.resetTestingModule())

	it('shows every tab to an admin', async () => {
		await setup(['admin'])
		expect(fixture.componentInstance.visibleTabs.length).toBe(7)
	})

	it('shows only the permitted tabs, plus the ungated logs tab', async () => {
		await setup(['settings:cloud'])

		expect(fixture.componentInstance.visibleTabs.map((t) => t.path)).toEqual(['cloud', 'logs'])
	})

	it('renders a nav link per visible tab', async () => {
		await setup(['settings:users'])

		const links = fixture.nativeElement.querySelectorAll('.nav-link')
		expect(links.length).toBe(2)
		expect(links[0].textContent.trim()).toBe('Users')
	})
})
