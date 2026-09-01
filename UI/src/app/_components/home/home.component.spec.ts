import { signal } from '@angular/core'
import { ComponentFixture, TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'

import { HomeComponent } from './home.component'
import { SocketService } from 'src/app/_services/socket.service'

class SocketServiceStub {
	public readonly externalAddress = signal<string | undefined>('http://0.0.0.0:4455/#/tally')
	public readonly interfaces = signal<any[]>([])
}

describe('HomeComponent', () => {
	let component: HomeComponent
	let fixture: ComponentFixture<HomeComponent>

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [HomeComponent],
			providers: [provideRouter([]), { provide: SocketService, useClass: SocketServiceStub }],
		}).compileComponents()
	})

	beforeEach(() => {
		fixture = TestBed.createComponent(HomeComponent)
		component = fixture.componentInstance
		fixture.detectChanges()
	})

	it('should create', () => {
		expect(component).toBeTruthy()
	})
})
