import { ComponentFixture, TestBed } from '@angular/core/testing'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

import { Source } from 'src/app/_models/Source'
import { SocketService } from 'src/app/_services/socket.service'
import { SocketServiceStub } from 'src/app/_testing/socket-service.stub'
import { SourceModalComponent } from './source-modal.component'

const TEST_TYPE = { id: 'type-a', label: 'Type A', help: 'help a' }
const OTHER_TYPE = { id: 'type-b', label: 'Type B', help: 'help b' }

describe('SourceModalComponent', () => {
	let fixture: ComponentFixture<SourceModalComponent>
	let component: SourceModalComponent
	let socketService: SocketServiceStub

	beforeEach(async () => {
		socketService = new SocketServiceStub()
		socketService.sourceTypes.set([TEST_TYPE, OTHER_TYPE])
		socketService.sourceTypeDataFields.set([
			{
				sourceTypeId: 'type-a',
				fields: [
					{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
					{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
					{ fieldName: 'note', fieldLabel: 'Note', fieldType: 'text', optional: true },
					{ fieldName: 'blurb', fieldLabel: 'Blurb', fieldType: 'info', text: 'read me' },
				],
			},
			{
				sourceTypeId: 'type-b',
				fields: [
					{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
					{ fieldName: 'channel', fieldLabel: 'Channel', fieldType: 'text' },
				],
			},
		])

		await TestBed.configureTestingModule({
			imports: [SourceModalComponent],
			providers: [
				{ provide: SocketService, useValue: socketService },
				{ provide: NgbActiveModal, useValue: { close: () => {}, dismiss: () => {} } },
			],
		}).compileComponents()

		fixture = TestBed.createComponent(SourceModalComponent)
		component = fixture.componentInstance
	})

	function createFor(source: Partial<Source>, editing = false, sourceTypeIdx?: number) {
		component.source = source as Source
		component.editing = editing
		component.sourceTypeIdx = sourceTypeIdx
		fixture.detectChanges()
	}

	it('starts invalid with no source type chosen and offers no save button', () => {
		createFor({ data: {} })

		expect(component.form.invalid).toBe(true)
		expect(component.form.controls.sourceTypeIdx.errors).toEqual({ required: true })
		expect(fixture.nativeElement.querySelector('button[type="submit"]')).toBeNull()
	})

	it('builds a control per field of the chosen type, skipping info fields', () => {
		createFor({ data: {} })
		component.form.controls.sourceTypeIdx.setValue(0)
		fixture.detectChanges()

		expect(Object.keys(component.form.controls.data.controls).sort()).toEqual(['ip', 'note', 'port'])
	})

	it('requires the fields the descriptor does not mark optional', () => {
		createFor({ name: 'Cam 1', data: {} }, false, 0)

		expect(component.dataControl('ip')!.errors).toEqual({ required: true })
		expect(component.dataControl('note')!.errors).toBeNull()
		expect(component.form.invalid).toBe(true)
	})

	it('rejects whitespace-only values the way the old save() did', () => {
		createFor({ name: 'Cam 1', data: {} }, false, 0)
		component.dataControl('ip')!.setValue('   ')

		expect(component.dataControl('ip')!.errors).toEqual({ required: true })
	})

	it('flags a port another source already holds, but not its own', () => {
		socketService.portsInUse.set([{ port: 9910, sourceId: 'other-source' }])
		createFor({ id: 'my-source', name: 'Cam 1', data: { ip: '10.0.0.1' } }, true, 0)

		component.dataControl('port')!.setValue(9910)
		expect(component.dataControl('port')!.errors).toEqual({ portInUse: true })

		socketService.portsInUse.set([{ port: 9910, sourceId: 'my-source' }])
		component.dataControl('port')!.updateValueAndValidity()
		expect(component.dataControl('port')!.errors).toBeNull()
	})

	it('shows the error inline and keeps the save button disabled while invalid', () => {
		createFor({ name: 'Cam 1', data: {} }, false, 0)
		const ip = component.dataControl('ip')!
		ip.markAsTouched()
		fixture.detectChanges()

		const submit: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]')
		expect(submit.disabled).toBe(true)
		expect(fixture.nativeElement.textContent).toContain('IP Address is required.')
	})

	it('rebuilds the data record when the source type changes, carrying shared field names over', () => {
		createFor({ data: {} })
		component.form.controls.sourceTypeIdx.setValue(0)
		fixture.detectChanges()
		component.dataControl('ip')!.setValue('10.0.0.5')
		component.dataControl('port')!.setValue(1234)

		component.form.controls.sourceTypeIdx.setValue(1)
		fixture.detectChanges()

		expect(Object.keys(component.form.controls.data.controls).sort()).toEqual(['channel', 'ip'])
		expect(component.dataControl('ip')!.value).toBe('10.0.0.5')
	})

	it('keeps the rendered inputs bound to the current record after a type change', () => {
		createFor({ data: {} })
		component.form.controls.sourceTypeIdx.setValue(0)
		fixture.detectChanges()
		component.form.controls.sourceTypeIdx.setValue(1)
		fixture.detectChanges()

		//"ip" exists on both types, so the row could be reused and left pointing at
		//a control that is no longer part of the form
		const input: HTMLInputElement = fixture.nativeElement.querySelector('#ip')
		input.value = '192.168.1.9'
		input.dispatchEvent(new Event('input'))

		expect(component.form.controls.data.get('ip')!.value).toBe('192.168.1.9')
	})

	it('does not emit while the form is invalid', () => {
		createFor({ name: '', data: {} }, false, 0)
		component.save()

		expect(socketService.lastEmit('manage')).toBeUndefined()
	})

	it('emits an add with the chosen type and preserves data keys outside the descriptor', () => {
		createFor({ name: 'Cam 1', data: { ip: '10.0.0.1', port: 9910, discovered: 'keep-me' } }, false, 0)
		component.save()

		const payload = socketService.lastEmit('manage')!.args[0]
		expect(payload.action).toBe('add')
		expect(payload.source.sourceTypeId).toBe('type-a')
		expect(payload.source.name).toBe('Cam 1')
		expect(payload.source.data.discovered).toBe('keep-me')
		expect(payload.source.enabled).toBe(true)
		expect(payload.source.reconnect).toBe(true)
	})

	it('emits an edit without forcing enabled back on', () => {
		createFor({ id: 's1', name: 'Cam 1', enabled: false, data: { ip: '10.0.0.1', port: 9910 } }, true, 0)
		component.save()

		const payload = socketService.lastEmit('manage')!.args[0]
		expect(payload.action).toBe('edit')
		expect(payload.source.enabled).toBe(false)
		expect(payload.source.sourceTypeId).toBe('type-a')
	})
})
