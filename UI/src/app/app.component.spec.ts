import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'

import { AppComponent } from './app.component'
import { SocketService } from './_services/socket.service'

// AppComponent pulls in AuthService, which pulls in SocketService. Left real,
// that opens an actual socket.io connection from the test runner.
class SocketServiceStub {
	public sendAccessToken() {}
}

describe('AppComponent', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [AppComponent],
			providers: [provideRouter([]), { provide: SocketService, useClass: SocketServiceStub }],
		}).compileComponents()
	})

	it('should create the app', () => {
		const fixture = TestBed.createComponent(AppComponent)
		expect(fixture.componentInstance).toBeTruthy()
	})

	it('should render the navigation', () => {
		const fixture = TestBed.createComponent(AppComponent)
		fixture.detectChanges()
		const links = fixture.nativeElement.querySelectorAll('nav .nav-link')
		expect(links.length).toBeGreaterThan(0)
	})
})
