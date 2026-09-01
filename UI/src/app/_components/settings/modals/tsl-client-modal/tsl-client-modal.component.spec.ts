import { ComponentFixture, TestBed } from '@angular/core/testing'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

import { TSLClient } from 'src/app/_models/TSLClient'
import { SocketService } from 'src/app/_services/socket.service'
import { SocketServiceStub } from 'src/app/_testing/socket-service.stub'
import { TslClientModalComponent, createDefaultTSLClient } from './tsl-client-modal.component'

describe('TslClientModalComponent', () => {
	let fixture: ComponentFixture<TslClientModalComponent>
	let component: TslClientModalComponent
	let socketService: SocketServiceStub

	beforeEach(async () => {
		socketService = new SocketServiceStub()

		await TestBed.configureTestingModule({
			imports: [TslClientModalComponent],
			providers: [
				{ provide: SocketService, useValue: socketService },
				{ provide: NgbActiveModal, useValue: { close: () => {}, dismiss: () => {} } },
			],
		}).compileComponents()

		fixture = TestBed.createComponent(TslClientModalComponent)
		component = fixture.componentInstance
	})

	function createFor(tslClient: any, editing = false) {
		component.tslClient = tslClient as TSLClient
		component.editing = editing
		fixture.detectChanges()
	}

	it('starts valid on the defaults a new client is created with', () => {
		createFor(createDefaultTSLClient())

		expect(component.form.valid).toBe(true)
		expect(component.form.controls.protocol.value).toBe('3.1')
		expect(component.form.controls.protocolOptions.controls.tally1.value).toBe('pvw')
	})

	it('requires an IP address and a port in range', () => {
		createFor(createDefaultTSLClient())
		component.form.controls.ip.setValue('')
		component.form.controls.port.setValue(70000)
		component.form.controls.port.markAsTouched()
		fixture.detectChanges()

		expect(component.form.invalid).toBe(true)
		expect(fixture.nativeElement.textContent).toContain('Port must be 65535 or less.')
		expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true)
	})

	it('swaps the option panel when the protocol changes', () => {
		createFor(createDefaultTSLClient())
		expect(fixture.nativeElement.querySelector('#tsl31Tally1Role')).not.toBeNull()

		component.form.controls.protocol.setValue('5.0')
		fixture.detectChanges()

		expect(fixture.nativeElement.querySelector('#tsl31Tally1Role')).toBeNull()
		expect(fixture.nativeElement.querySelector('#tsl5LeftTallyRole')).not.toBeNull()
	})

	it('sends both protocol option sets so a protocol switch keeps its mapping', () => {
		createFor(createDefaultTSLClient())
		component.form.controls.protocolOptions.controls.tally3.setValue('pgm')
		component.save()

		const payload = socketService.lastEmit('manage')!.args[0]
		expect(payload.action).toBe('add')
		expect(payload.tslClient.protocolOptions.tally3).toBe('pgm')
		expect(payload.tslClient.protocolOptions.lh_tally).toBe('pgm')
	})

	it('emits an edit that keeps the existing id', () => {
		createFor({ id: 'tsl-1', ip: '10.0.0.4', port: 5720, transport: 'tcp', protocol: '5.0', protocolOptions: {} }, true)
		component.save()

		const payload = socketService.lastEmit('manage')!.args[0]
		expect(payload.action).toBe('edit')
		expect(payload.tslClient.id).toBe('tsl-1')
		expect(payload.tslClient.transport).toBe('tcp')
	})
})
