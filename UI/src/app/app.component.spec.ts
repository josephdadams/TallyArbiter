import { TestBed } from '@angular/core/testing'
import { provideNoopAnimations } from '@angular/platform-browser/animations'
import { provideRouter } from '@angular/router'

import { AppComponent } from './app.component'
import { SocketService } from './_services/socket.service'
import { SocketServiceStub } from './_testing/socket-service.stub'

describe('AppComponent', () => {
	let socketService: SocketServiceStub

	beforeEach(async () => {
		socketService = new SocketServiceStub()
		await TestBed.configureTestingModule({
			imports: [AppComponent],
			providers: [provideRouter([]), provideNoopAnimations(), { provide: SocketService, useValue: socketService }],
		}).compileComponents()
	})

	it('should create the app', () => {
		const fixture = TestBed.createComponent(AppComponent)
		expect(fixture.componentInstance).toBeTruthy()
	})

	it('should render the navigation', () => {
		const fixture = TestBed.createComponent(AppComponent)
		fixture.detectChanges()

		expect(fixture.nativeElement.querySelectorAll('nav .nav-link').length).toBeGreaterThan(0)
	})

	it('stays quiet about sources while they are all connected', () => {
		socketService.sources.set([{ id: 's1', name: 'ATEM', enabled: true, connected: true }])
		const fixture = TestBed.createComponent(AppComponent)
		fixture.detectChanges()

		expect(fixture.nativeElement.querySelector('.source-alert')).toBeNull()
	})

	// A source going down freezes every device it feeds, and the tab that owns it
	// is not necessarily the tab anyone is looking at.
	it('warns from anywhere in the app when a source goes down', () => {
		socketService.sources.set([
			{ id: 's1', name: 'ATEM', enabled: true, connected: false },
			{ id: 's2', name: 'vMix', enabled: true, connected: true },
		])
		const fixture = TestBed.createComponent(AppComponent)
		fixture.detectChanges()

		const alert = fixture.nativeElement.querySelector('.source-alert')
		expect(alert.textContent).toContain('1 source down')
		expect(alert.getAttribute('title')).toBe('Not connected: ATEM')
	})

	it('does not count a source the user deliberately disabled', () => {
		socketService.sources.set([{ id: 's1', name: 'Retired', enabled: false, connected: false }])
		const fixture = TestBed.createComponent(AppComponent)
		fixture.detectChanges()

		expect(fixture.nativeElement.querySelector('.source-alert')).toBeNull()
	})

	it('shows the connection banner only while the socket is down', () => {
		const fixture = TestBed.createComponent(AppComponent)
		fixture.detectChanges()
		expect(fixture.nativeElement.querySelector('#connLostSnackbar')).toBeNull()

		socketService.connected.set(false)
		fixture.detectChanges()
		expect(fixture.nativeElement.querySelector('#connLostSnackbar')).toBeTruthy()
	})
})
