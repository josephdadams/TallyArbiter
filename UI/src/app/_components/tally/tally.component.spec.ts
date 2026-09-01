import { ComponentFixture, TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'

import { NavbarVisibilityService } from 'src/app/_services/navbar-visibility.service'
import { SocketService } from 'src/app/_services/socket.service'
import { SocketServiceStub } from 'src/app/_testing/socket-service.stub'
import { TallyComponent } from './tally.component'

const PROGRAM = { id: 'pgm', label: 'Program', type: 'program', color: '#e43f5a', priority: 200 }
const PREVIEW = { id: 'pvw', label: 'Preview', type: 'preview', color: '#3fe481', priority: 50 }

describe('TallyComponent', () => {
	let fixture: ComponentFixture<TallyComponent>
	let socketService: SocketServiceStub
	let navbar: NavbarVisibilityService

	beforeEach(async () => {
		socketService = new SocketServiceStub()
		await TestBed.configureTestingModule({
			imports: [TallyComponent],
			providers: [provideRouter([]), { provide: SocketService, useValue: socketService }],
		}).compileComponents()

		navbar = TestBed.inject(NavbarVisibilityService)
		fixture = TestBed.createComponent(TallyComponent)
		socketService.busOptions.set([PROGRAM, PREVIEW])
		socketService.devices.set([{ id: 'd1', name: 'Camera 1', description: 'Stage left' }])
		fixture.detectChanges()
	})

	function selectDevice() {
		fixture.componentInstance.currentDeviceIdx.set(0)
		fixture.detectChanges()
	}

	it('offers a card per device until one is chosen', () => {
		expect(fixture.nativeElement.querySelectorAll('.device-card').length).toBe(1)
		expect(fixture.nativeElement.querySelector('.tally')).toBeNull()
	})

	it('offers a way to add one when there are no devices', () => {
		socketService.devices.set([])
		fixture.detectChanges()

		expect(fixture.nativeElement.textContent).toContain('No devices to monitor yet')
		expect(fixture.nativeElement.querySelector('.empty-state .btn')).toBeTruthy()
	})

	it('reads STANDBY, not blank, when the device is on no bus', () => {
		selectDevice()
		expect(fixture.nativeElement.querySelector('.tally__bus').textContent.trim()).toBe('STANDBY')
	})

	it('names the bus in text as well as colour', () => {
		selectDevice()
		socketService.device_states.set([{ deviceId: 'd1', busId: 'pgm', sources: ['s1'] }])
		fixture.detectChanges()

		expect(fixture.nativeElement.querySelector('.tally__bus').textContent.trim()).toBe('PROGRAM')
		expect(fixture.componentInstance.background()).toBe('#e43f5a')
	})

	it('takes the highest priority bus when the device is on several', () => {
		selectDevice()
		socketService.device_states.set([
			{ deviceId: 'd1', busId: 'pvw', sources: ['s1'] },
			{ deviceId: 'd1', busId: 'pgm', sources: ['s2'] },
		])
		fixture.detectChanges()

		expect(fixture.componentInstance.currentBus()?.id).toBe('pgm')
	})

	it('ignores busses belonging to other devices', () => {
		selectDevice()
		socketService.device_states.set([{ deviceId: 'other', busId: 'pgm', sources: ['s1'] }])
		fixture.detectChanges()

		expect(fixture.componentInstance.currentBus()).toBeUndefined()
	})

	// Bus colours come from the user's config, so the text colour can't be a
	// constant — on the default preview green, white is unreadable.
	it('puts white text on the dark program red', () => {
		selectDevice()
		socketService.device_states.set([{ deviceId: 'd1', busId: 'pgm', sources: ['s1'] }])
		fixture.detectChanges()

		expect(fixture.componentInstance.foreground()).toBe('#ffffff')
	})

	it('puts black text on the light preview green', () => {
		selectDevice()
		socketService.device_states.set([{ deviceId: 'd1', busId: 'pvw', sources: ['s1'] }])
		fixture.detectChanges()

		expect(fixture.componentInstance.foreground()).toBe('#000000')
	})

	// A frozen colour looks exactly like a correct one, and someone reads this to
	// decide whether they are on air.
	describe('when the connection drops', () => {
		beforeEach(() => {
			selectDevice()
			socketService.device_states.set([{ deviceId: 'd1', busId: 'pgm', sources: ['s1'] }])
			fixture.detectChanges()
			socketService.connected.set(false)
			fixture.detectChanges()
		})

		it('stops claiming the device is on a bus', () => {
			expect(fixture.componentInstance.stale()).toBe(true)
			expect(fixture.nativeElement.querySelector('.tally__bus').textContent.trim()).toBe('NO CONNECTION')
		})

		it('says outright that the state may be out of date', () => {
			expect(fixture.nativeElement.textContent).toContain('may be out of date')
		})

		it('covers the last known colour rather than showing it as current', () => {
			expect(fixture.nativeElement.querySelector('.tally--stale')).toBeTruthy()
			expect(fixture.componentInstance.foreground()).toBe('#ffffff')
		})

		it('announces the change assertively, not politely', () => {
			expect(fixture.nativeElement.querySelector('.tally__state').getAttribute('aria-live')).toBe('assertive')
		})

		it('goes back to reporting the bus once the socket returns', () => {
			socketService.connected.set(true)
			fixture.detectChanges()

			expect(fixture.componentInstance.stale()).toBe(false)
			expect(fixture.nativeElement.querySelector('.tally__bus').textContent.trim()).toBe('PROGRAM')
			expect(fixture.nativeElement.querySelector('.tally--stale')).toBeNull()
		})
	})

	it('hides the app chrome while a device is showing, and restores it after', () => {
		expect(navbar.navbarIsVisible()).toBe(true)

		selectDevice()
		expect(navbar.navbarIsVisible()).toBe(false)

		fixture.destroy()
		expect(navbar.navbarIsVisible()).toBe(true)
	})
})
