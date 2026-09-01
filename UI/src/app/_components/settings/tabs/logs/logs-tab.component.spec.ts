import { ComponentFixture, TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'

import { SocketService } from 'src/app/_services/socket.service'
import { SocketServiceStub } from 'src/app/_testing/socket-service.stub'
import { LogsTabComponent } from './logs-tab.component'

describe('LogsTabComponent', () => {
	let fixture: ComponentFixture<LogsTabComponent>
	let socketService: SocketServiceStub

	beforeEach(async () => {
		socketService = new SocketServiceStub()
		await TestBed.configureTestingModule({
			imports: [LogsTabComponent],
			providers: [provideRouter([]), { provide: SocketService, useValue: socketService }],
		}).compileComponents()

		fixture = TestBed.createComponent(LogsTabComponent)
		socketService.logs.set([
			{ datetime: '1', log: 'boom', type: 'error' },
			{ datetime: '2', log: 'chatty', type: 'info-quiet' },
			{ datetime: '3', log: 'normal', type: 'info' },
		])
		fixture.detectChanges()
	})

	it('shows everything at or above the selected level', () => {
		expect(fixture.componentInstance.visibleLogs().map((l) => l.log)).toEqual(['boom', 'normal'])
	})

	it('widens to verbose when the level changes', () => {
		fixture.componentInstance.setLogLevel('info-quiet')
		expect(fixture.componentInstance.visibleLogs().map((l) => l.log)).toEqual(['boom', 'chatty', 'normal'])
	})

	it('narrows to errors only', () => {
		fixture.componentInstance.setLogLevel('error')
		expect(fixture.componentInstance.visibleLogs().map((l) => l.log)).toEqual(['boom'])
	})

	it('picks up a log line that arrives after the first render', () => {
		socketService.logs.update((logs: any[]) => [...logs, { datetime: '4', log: 'later', type: 'error' }])
		fixture.detectChanges()

		expect(fixture.componentInstance.visibleLogs().map((l) => l.log)).toContain('later')
		expect(fixture.nativeElement.textContent).toContain('later')
	})
})
