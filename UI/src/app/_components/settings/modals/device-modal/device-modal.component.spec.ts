import { ComponentFixture, TestBed } from '@angular/core/testing'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

import { Device } from 'src/app/_models/Device'
import { SocketService } from 'src/app/_services/socket.service'
import { SocketServiceStub } from 'src/app/_testing/socket-service.stub'
import { DeviceModalComponent } from './device-modal.component'

describe('DeviceModalComponent', () => {
	let fixture: ComponentFixture<DeviceModalComponent>
	let component: DeviceModalComponent
	let socketService: SocketServiceStub

	beforeEach(async () => {
		socketService = new SocketServiceStub()
		socketService.busOptions.set([{ id: 'preview', label: 'Preview' }])
		socketService.cameraModels.set([{ id: 'cam-a', label: 'Camera A' }])

		await TestBed.configureTestingModule({
			imports: [DeviceModalComponent],
			providers: [
				{ provide: SocketService, useValue: socketService },
				{ provide: NgbActiveModal, useValue: { close: () => {}, dismiss: () => {} } },
			],
		}).compileComponents()

		fixture = TestBed.createComponent(DeviceModalComponent)
		component = fixture.componentInstance
	})

	function createFor(device: Partial<Device>, editing = false) {
		component.device = device as Device
		component.editing = editing
		fixture.detectChanges()
	}

	it('requires a device name', () => {
		createFor({})

		expect(component.form.controls.name.errors).toEqual({ required: true })
		expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true)
	})

	it('rejects a TSL address above the protocol ceiling instead of silently clamping it', () => {
		createFor({ name: 'Camera 1' })
		component.form.controls.tslAddress.setValue(200)
		component.form.controls.tslAddress.markAsTouched()
		fixture.detectChanges()

		expect(component.form.invalid).toBe(true)
		expect(fixture.nativeElement.textContent).toContain('TSL Address must be 126 or less.')

		component.save()
		expect(socketService.lastEmit('manage')).toBeUndefined()
	})

	it('leaves the TSL address optional', () => {
		createFor({ name: 'Camera 1' })

		expect(component.form.valid).toBe(true)
		component.save()

		expect(socketService.lastEmit('manage')!.args[0].device.tslAddress).toBe('')
	})

	it('enables a newly added device', () => {
		createFor({})
		component.form.controls.name.setValue('Camera 1')
		component.save()

		const payload = socketService.lastEmit('manage')!.args[0]
		expect(payload.action).toBe('add')
		expect(payload.device.enabled).toBe(true)
	})

	it('respects the enabled checkbox when editing', () => {
		createFor({ id: 'd1', name: 'Camera 1', enabled: true }, true)
		component.form.controls.enabled.setValue(false)
		component.save()

		const payload = socketService.lastEmit('manage')!.args[0]
		expect(payload.action).toBe('edit')
		expect(payload.device.enabled).toBe(false)
	})

	it('sends the TSL address back as a string', () => {
		createFor({ name: 'Camera 1' })
		component.form.controls.tslAddress.setValue(12)
		component.save()

		expect(socketService.lastEmit('manage')!.args[0].device.tslAddress).toBe('12')
	})
})
