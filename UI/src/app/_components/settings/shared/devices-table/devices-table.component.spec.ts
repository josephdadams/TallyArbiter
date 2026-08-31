import { ComponentFixture, TestBed } from '@angular/core/testing'

import { SocketService } from 'src/app/_services/socket.service'
import { SocketServiceStub } from 'src/app/_testing/socket-service.stub'
import { DevicesTableComponent } from './devices-table.component'

describe('DevicesTableComponent', () => {
	let fixture: ComponentFixture<DevicesTableComponent>
	let socketService: SocketServiceStub

	beforeEach(async () => {
		socketService = new SocketServiceStub()
		await TestBed.configureTestingModule({
			imports: [DevicesTableComponent],
			providers: [{ provide: SocketService, useValue: socketService }],
		}).compileComponents()

		fixture = TestBed.createComponent(DevicesTableComponent)
		socketService.busOptions.set([{ id: 'pgm', label: 'Program', color: '#e43f5a', visible: true }])
		socketService.devices.set([{ id: 'd1', name: 'Camera 1', enabled: true }])
		fixture.detectChanges()
	})

	it('shows an empty state with no devices', () => {
		socketService.devices.set([])
		fixture.detectChanges()

		expect(fixture.nativeElement.textContent).toContain('No devices configured.')
	})

	it('hides the row actions unless editMode is set', () => {
		expect(fixture.nativeElement.querySelectorAll('button').length).toBe(0)

		fixture.componentRef.setInput('editMode', true)
		fixture.detectChanges()

		expect(fixture.nativeElement.textContent).toContain('Edit Sources')
	})

	it('marks a bus cell active only while the device is on that bus', () => {
		const cell = () => fixture.nativeElement.querySelector('.bus-cell')
		expect(cell().getAttribute('aria-label')).toBe('Program: inactive')

		socketService.device_states.set([{ deviceId: 'd1', busId: 'pgm', sources: ['s1'] }])
		fixture.detectChanges()

		expect(cell().getAttribute('aria-label')).toBe('Program: active')
		expect(cell().style.backgroundColor).toBe('rgb(228, 63, 90)')
	})

	it('counts the sources and actions belonging to each device', () => {
		socketService.deviceSources.set([
			{ id: 'ds1', deviceId: 'd1' },
			{ id: 'ds2', deviceId: 'd1' },
		])
		socketService.deviceActions.set([{ id: 'da1', deviceId: 'other' }])
		fixture.componentRef.setInput('editMode', true)
		fixture.detectChanges()

		expect(fixture.nativeElement.textContent).toContain('Edit Sources (2)')
		expect(fixture.nativeElement.textContent).toContain('Edit Actions (0)')
	})
})
