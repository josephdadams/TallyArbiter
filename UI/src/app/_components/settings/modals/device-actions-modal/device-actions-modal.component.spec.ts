import { ComponentFixture, TestBed } from '@angular/core/testing'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

import { Device } from 'src/app/_models/Device'
import { DeviceAction } from 'src/app/_models/DeviceAction'
import { SocketService } from 'src/app/_services/socket.service'
import { SocketServiceStub } from 'src/app/_testing/socket-service.stub'
import { DeviceActionsModalComponent } from './device-actions-modal.component'

describe('DeviceActionsModalComponent', () => {
	let fixture: ComponentFixture<DeviceActionsModalComponent>
	let component: DeviceActionsModalComponent
	let socketService: SocketServiceStub

	/** the form only exists while a row is open for editing */
	const form = () => component.form()!

	beforeEach(async () => {
		socketService = new SocketServiceStub()
		socketService.busOptions.set([{ id: 'preview', label: 'Preview' }])
		socketService.outputTypes.set([
			{ id: 'out-a', label: 'Generic UDP' },
			{ id: 'out-b', label: 'Generic TCP' },
		])
		socketService.outputTypeDataFields.set([
			{
				outputTypeId: 'out-a',
				fields: [
					{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
					{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
					{
						fieldName: 'end',
						fieldLabel: 'End Character',
						fieldType: 'dropdown',
						options: [
							{ id: '', label: 'None' },
							{ id: '\n', label: 'LF' },
						],
					},
				],
			},
			{
				outputTypeId: 'out-b',
				fields: [
					{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
					{ fieldName: 'command', fieldLabel: 'Command', fieldType: 'text' },
				],
			},
		])

		await TestBed.configureTestingModule({
			imports: [DeviceActionsModalComponent],
			providers: [
				{ provide: SocketService, useValue: socketService },
				{ provide: NgbActiveModal, useValue: { close: () => {}, dismiss: () => {} } },
			],
		}).compileComponents()

		fixture = TestBed.createComponent(DeviceActionsModalComponent)
		component = fixture.componentInstance
		component.device = { id: 'dev-1', name: 'Camera 1' } as Device
		fixture.detectChanges()
	})

	it('lists the actions belonging to this device only', () => {
		socketService.deviceActions.set([
			{ id: 'a1', deviceId: 'dev-1', busId: 'preview', active: true, outputTypeId: 'out-a' },
			{ id: 'a2', deviceId: 'dev-2', busId: 'preview', active: true, outputTypeId: 'out-a' },
		])
		fixture.detectChanges()

		expect(component.deviceActions().map((a) => a.id)).toEqual(['a1'])
	})

	it('opens a blank, invalid form when adding', () => {
		component.addDeviceAction()
		fixture.detectChanges()
		fixture.detectChanges()

		expect(form().invalid).toBe(true)
		expect(form().controls.outputTypeIdx.errors).toEqual({ required: true })
		expect(form().controls.busId.errors).toEqual({ required: true })
	})

	it('keeps the save button disabled and explains the missing output type', () => {
		component.addDeviceAction()
		fixture.detectChanges()
		form().controls.busId.setValue('preview')
		form().controls.active.setValue(true)
		form().controls.outputTypeIdx.markAsTouched()
		fixture.detectChanges()

		const submit: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]')
		expect(submit.disabled).toBe(true)
		expect(fixture.nativeElement.textContent).toContain('Output Type is required.')
	})

	it('builds the data record from the chosen output type', () => {
		component.addDeviceAction()
		fixture.detectChanges()
		form().controls.outputTypeIdx.setValue(0)
		fixture.detectChanges()

		expect(Object.keys(form().controls.data.controls).sort()).toEqual(['end', 'ip', 'port'])
	})

	it('requires the output type fields the descriptor does not mark optional', () => {
		component.addDeviceAction()
		fixture.detectChanges()
		form().controls.busId.setValue('preview')
		form().controls.active.setValue(false)
		form().controls.outputTypeIdx.setValue(0)
		fixture.detectChanges()

		expect(form().invalid).toBe(true)
		expect(form().controls.data.get('ip')!.errors).toEqual({ required: true })
	})

	it("accepts a dropdown's empty option as an answer", () => {
		//the Generic UDP action's End Character offers '' for "None"; requiring it to
		//be non-blank would make that choice unselectable, and leaving it unanswered
		//is what used to append a literal "undefined" to the payload
		component.addDeviceAction()
		fixture.detectChanges()
		form().controls.busId.setValue('preview')
		form().controls.active.setValue(false)
		form().controls.outputTypeIdx.setValue(0)
		fixture.detectChanges()

		expect(form().controls.data.get('end')!.errors).toEqual({ required: true })

		form().controls.data.get('ip')!.setValue('10.0.0.1')
		form().controls.data.get('port')!.setValue(7000)
		form().controls.data.get('end')!.setValue('')

		expect(form().controls.data.get('end')!.errors).toBeNull()
		expect(form().valid).toBe(true)
	})

	it('keeps the rendered inputs bound to the current record after an output type change', () => {
		component.addDeviceAction()
		fixture.detectChanges()
		form().controls.outputTypeIdx.setValue(0)
		fixture.detectChanges()
		form().controls.outputTypeIdx.setValue(1)
		fixture.detectChanges()

		const input: HTMLInputElement = fixture.nativeElement.querySelector('#ip')
		input.value = '10.1.2.3'
		input.dispatchEvent(new Event('input'))

		expect(form().controls.data.get('ip')!.value).toBe('10.1.2.3')
	})

	it('emits an add without leaking the volatile output type index', () => {
		component.addDeviceAction()
		fixture.detectChanges()
		form().controls.busId.setValue('preview')
		form().controls.active.setValue(true)
		form().controls.outputTypeIdx.setValue(0)
		fixture.detectChanges()
		form().controls.data.get('ip')!.setValue('10.0.0.1')
		form().controls.data.get('port')!.setValue(7000)
		form().controls.data.get('end')!.setValue('')

		component.saveDeviceAction()

		const payload = socketService.lastEmit('manage')!.args[0]
		expect(payload.action).toBe('add')
		expect(payload.device_action.deviceId).toBe('dev-1')
		expect(payload.device_action.outputTypeId).toBe('out-a')
		expect(payload.device_action.data.ip).toBe('10.0.0.1')
		expect(payload.device_action.outputTypeIdx).toBeUndefined()
		expect(payload.device_action.id).toBeUndefined()
	})

	it('emits an edit for a row opened from the list', () => {
		const action = {
			id: 'a1',
			deviceId: 'dev-1',
			busId: 'preview',
			active: false,
			outputTypeId: 'out-a',
			data: { ip: '10.0.0.9', legacy: 'keep-me' },
		} as unknown as DeviceAction
		socketService.deviceActions.set([action])
		fixture.detectChanges()

		component.editDeviceAction(action)
		fixture.detectChanges()
		expect(form().controls.outputTypeIdx.value).toBe(0)
		expect(form().controls.data.get('ip')!.value).toBe('10.0.0.9')

		//the stored row predates the required rule and has no port or end character,
		//so it is held back until they are answered rather than saved incomplete
		expect(form().invalid).toBe(true)
		form().controls.data.get('port')!.setValue(7000)
		form().controls.data.get('end')!.setValue('')

		component.saveDeviceAction()

		const payload = socketService.lastEmit('manage')!.args[0]
		expect(payload.action).toBe('edit')
		expect(payload.device_action.id).toBe('a1')
		expect(payload.device_action.data.legacy).toBe('keep-me')
	})

	it('returns to the list after saving', () => {
		component.addDeviceAction()
		fixture.detectChanges()
		form().controls.busId.setValue('preview')
		form().controls.active.setValue(true)
		form().controls.outputTypeIdx.setValue(0)
		fixture.detectChanges()
		form().controls.data.get('ip')!.setValue('10.0.0.1')
		form().controls.data.get('port')!.setValue(7000)
		form().controls.data.get('end')!.setValue('')
		component.saveDeviceAction()

		expect(component.form()).toBeNull()
	})
})
