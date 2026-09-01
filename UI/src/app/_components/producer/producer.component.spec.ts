import { ComponentFixture, TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'

import { SocketService } from 'src/app/_services/socket.service'
import { SocketServiceStub } from 'src/app/_testing/socket-service.stub'
import { ProducerComponent } from './producer.component'

const PROGRAM = { id: 'pgm', label: 'Program', type: 'program', color: '#e43f5a', priority: 200, visible: true }
const PREVIEW = { id: 'pvw', label: 'Preview', type: 'preview', color: '#3fe481', priority: 50, visible: true }

describe('ProducerComponent', () => {
	let fixture: ComponentFixture<ProducerComponent>
	let socketService: SocketServiceStub

	beforeEach(async () => {
		socketService = new SocketServiceStub()
		await TestBed.configureTestingModule({
			imports: [ProducerComponent],
			providers: [provideRouter([]), { provide: SocketService, useValue: socketService }],
		}).compileComponents()

		fixture = TestBed.createComponent(ProducerComponent)
		socketService.busOptions.set([PROGRAM, PREVIEW])
		socketService.devices.set([
			{ id: 'd1', name: 'Camera 1', description: 'Stage left', enabled: true },
			{ id: 'd2', name: 'Camera 2', description: 'Balcony', enabled: true },
		])
		fixture.detectChanges()
	})

	it('points at settings when nothing is configured', () => {
		socketService.devices.set([])
		fixture.detectChanges()

		expect(fixture.nativeElement.textContent).toContain('No devices configured')
		expect(fixture.nativeElement.querySelector('.empty-state .btn')).toBeTruthy()
	})

	it('shows a card per device, standing by until state arrives', () => {
		expect(fixture.nativeElement.querySelectorAll('.device-status').length).toBe(2)
		expect(fixture.nativeElement.querySelectorAll('.bus-chip--idle').length).toBe(2)
	})

	it('names each active bus on the card', () => {
		socketService.device_states.set([{ deviceId: 'd1', busId: 'pgm', sources: ['s1'] }])
		fixture.detectChanges()

		const chips = [...fixture.nativeElement.querySelectorAll('.bus-chip')].map((c: any) => c.textContent.trim())
		expect(chips).toContain('Program')
	})

	it('orders a device on several busses by priority', () => {
		socketService.device_states.set([
			{ deviceId: 'd1', busId: 'pvw', sources: ['s1'] },
			{ deviceId: 'd1', busId: 'pgm', sources: ['s2'] },
		])
		fixture.detectChanges()

		expect(fixture.componentInstance.statuses()[0].busses.map((b) => b.id)).toEqual(['pgm', 'pvw'])
	})

	it('counts only the devices actually on program as live', () => {
		socketService.device_states.set([
			{ deviceId: 'd1', busId: 'pgm', sources: ['s1'] },
			{ deviceId: 'd2', busId: 'pvw', sources: ['s2'] },
		])
		fixture.detectChanges()

		expect(fixture.componentInstance.liveCount()).toBe(1)
		expect(fixture.nativeElement.textContent).toContain('1 live')
	})

	it('filters by name and by description', () => {
		fixture.componentInstance.filter.set('balcony')
		fixture.detectChanges()

		expect(fixture.componentInstance.visibleStatuses().map((s) => s.device.id)).toEqual(['d2'])

		fixture.componentInstance.filter.set('camera 1')
		expect(fixture.componentInstance.visibleStatuses().map((s) => s.device.id)).toEqual(['d1'])
	})

	it('says so when a filter matches nothing, and offers a way back', () => {
		fixture.componentInstance.filter.set('nothing matches this')
		fixture.detectChanges()

		expect(fixture.nativeElement.textContent).toContain('No device matches')

		fixture.componentInstance.clearFilter()
		fixture.detectChanges()
		expect(fixture.nativeElement.querySelectorAll('.device-status').length).toBe(2)
	})

	it('picks readable text for each bus colour', () => {
		expect(fixture.componentInstance.contrastColor(PROGRAM.color)).toBe('#ffffff')
		expect(fixture.componentInstance.contrastColor(PREVIEW.color)).toBe('#000000')
	})
})
