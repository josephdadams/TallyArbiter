import { ComponentFixture, TestBed } from '@angular/core/testing'

import { SocketService } from 'src/app/_services/socket.service'
import { SocketServiceStub } from 'src/app/_testing/socket-service.stub'
import { TestingTabComponent } from './testing-tab.component'

describe('TestingTabComponent', () => {
	let fixture: ComponentFixture<TestingTabComponent>
	let socketService: SocketServiceStub

	beforeEach(async () => {
		socketService = new SocketServiceStub()
		await TestBed.configureTestingModule({
			imports: [TestingTabComponent],
			providers: [{ provide: SocketService, useValue: socketService }],
		}).compileComponents()

		fixture = TestBed.createComponent(TestingTabComponent)
		fixture.detectChanges()
	})

	it('reports test mode off when no TEST source exists', () => {
		expect(fixture.componentInstance.testModeOn()).toBe(false)
		expect(fixture.nativeElement.textContent).toContain('Turn On Test Mode')
	})

	it('reports test mode on once the server adds the TEST source', () => {
		socketService.sources.set([{ id: 'TEST' }])
		fixture.detectChanges()

		expect(fixture.componentInstance.testModeOn()).toBe(true)
		expect(fixture.nativeElement.textContent).toContain('Turn Off Test Mode')
	})

	it('sends the configured interval when switching test mode on', () => {
		socketService.testModeInterval.set(250)
		fixture.componentInstance.setTestMode(true, socketService.testModeInterval())

		expect(socketService.lastEmit('testmode')?.args).toEqual([true, 250])
	})
})
