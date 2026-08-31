import { ComponentFixture, TestBed } from '@angular/core/testing'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

import { Device } from 'src/app/_models/Device'
import { DeviceSource } from 'src/app/_models/DeviceSource'
import { SocketService } from 'src/app/_services/socket.service'
import { SocketServiceStub } from 'src/app/_testing/socket-service.stub'
import { DeviceSourcesModalComponent } from './device-sources-modal.component'

describe('DeviceSourcesModalComponent', () => {
	let fixture: ComponentFixture<DeviceSourcesModalComponent>
	let component: DeviceSourcesModalComponent
	let socketService: SocketServiceStub

	/** the form only exists while a row is open for editing */
	const form = () => component.form()!

	beforeEach(async () => {
		socketService = new SocketServiceStub()
		socketService.sourceTypes.set([
			{ id: 'type-with-busses', busses: [{ bus: 'preview', name: 'Preview' }] },
			{ id: 'type-without-busses', busses: [] },
		])
		socketService.sources.set([
			{ id: 'src-1', name: 'Switcher', sourceTypeId: 'type-with-busses' },
			{ id: 'src-2', name: 'Playout', sourceTypeId: 'type-without-busses' },
		])
		socketService.addresses.set({ 'src-1': [{ address: '1', label: 'Input 1' }], 'src-2': [] })

		await TestBed.configureTestingModule({
			imports: [DeviceSourcesModalComponent],
			providers: [
				{ provide: SocketService, useValue: socketService },
				{ provide: NgbActiveModal, useValue: { close: () => {}, dismiss: () => {} } },
			],
		}).compileComponents()

		fixture = TestBed.createComponent(DeviceSourcesModalComponent)
		component = fixture.componentInstance
		component.device = { id: 'dev-1', name: 'Camera 1' } as Device
		fixture.detectChanges()
	})

	it('opens a blank, invalid form when adding', () => {
		component.addDeviceSource()
		fixture.detectChanges()
		fixture.detectChanges()

		expect(form().controls.sourceIdx.errors).toEqual({ required: true })
		expect(form().controls.address.errors).toEqual({ required: true })
		expect(form().invalid).toBe(true)
	})

	it('explains the missing source inline and keeps save disabled', () => {
		component.addDeviceSource()
		fixture.detectChanges()
		form().controls.sourceIdx.markAsTouched()
		fixture.detectChanges()

		const submit: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]')
		expect(submit.disabled).toBe(true)
		expect(fixture.nativeElement.textContent).toContain('Source is required.')
	})

	it('asks the server for the addresses of the source that was picked', () => {
		component.addDeviceSource()
		fixture.detectChanges()
		form().controls.sourceIdx.setValue(0)

		expect(socketService.lastEmit('source_tallydata')!.args).toEqual(['src-1'])
	})

	it('requires a bus only when the source type defines them', () => {
		component.addDeviceSource()
		fixture.detectChanges()
		form().controls.sourceIdx.setValue(0)
		fixture.detectChanges()
		expect(form().controls.bus.errors).toEqual({ required: true })

		form().controls.sourceIdx.setValue(1)
		fixture.detectChanges()
		expect(form().controls.bus.errors).toBeNull()
	})

	it('clears a bus that does not belong to the newly chosen source type', () => {
		component.addDeviceSource()
		fixture.detectChanges()
		form().controls.sourceIdx.setValue(0)
		form().controls.bus.setValue('preview')

		form().controls.sourceIdx.setValue(1)

		expect(form().controls.bus.value).toBeNull()
	})

	it('emits an add without leaking the volatile source index', () => {
		component.addDeviceSource()
		fixture.detectChanges()
		form().controls.sourceIdx.setValue(1)
		form().controls.address.setValue('12')
		fixture.detectChanges()

		component.saveDeviceSource()

		const payload = socketService.lastEmit('manage')!.args[0]
		expect(payload.action).toBe('add')
		expect(payload.device_source.deviceId).toBe('dev-1')
		expect(payload.device_source.sourceId).toBe('src-2')
		expect(payload.device_source.address).toBe('12')
		expect(payload.device_source.sourceIdx).toBeUndefined()
	})

	it('emits an edit for a row opened from the list', () => {
		const deviceSource = {
			id: 'ds-1',
			deviceId: 'dev-1',
			sourceId: 'src-1',
			address: '1',
			bus: 'preview',
			rename: true,
		} as DeviceSource
		socketService.deviceSources.set([deviceSource])
		fixture.detectChanges()

		component.editDeviceSource(deviceSource)
		fixture.detectChanges()
		expect(form().valid).toBe(true)

		component.saveDeviceSource()

		const payload = socketService.lastEmit('manage')!.args[0]
		expect(payload.action).toBe('edit')
		expect(payload.device_source.id).toBe('ds-1')
		expect(payload.device_source.rename).toBe(true)
	})

	it('does not emit while the form is invalid', () => {
		component.addDeviceSource()
		fixture.detectChanges()
		component.saveDeviceSource()

		expect(socketService.lastEmit('manage')).toBeUndefined()
	})
})
