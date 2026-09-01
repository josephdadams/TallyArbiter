import { ComponentFixture, TestBed } from '@angular/core/testing'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

import { SocketService } from 'src/app/_services/socket.service'
import { SocketServiceStub } from 'src/app/_testing/socket-service.stub'
import { CloudKeyModalComponent } from './cloud-key-modal.component'

describe('CloudKeyModalComponent', () => {
	let fixture: ComponentFixture<CloudKeyModalComponent>
	let component: CloudKeyModalComponent
	let socketService: SocketServiceStub
	let closed: boolean

	beforeEach(async () => {
		socketService = new SocketServiceStub()
		closed = false

		await TestBed.configureTestingModule({
			imports: [CloudKeyModalComponent],
			providers: [
				{ provide: SocketService, useValue: socketService },
				{ provide: NgbActiveModal, useValue: { close: () => (closed = true), dismiss: () => {} } },
			],
		}).compileComponents()

		fixture = TestBed.createComponent(CloudKeyModalComponent)
		component = fixture.componentInstance
		fixture.detectChanges()
	})

	it('starts invalid with the save button disabled', () => {
		expect(component.form.invalid).toBe(true)
		expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true)
	})

	it('does not emit a blank key', () => {
		component.save()

		expect(socketService.lastEmit('manage')).toBeUndefined()
		expect(closed).toBe(false)
	})

	it('emits the key and closes once one is entered', () => {
		component.form.controls.key.setValue('a-cloud-key')
		fixture.detectChanges()

		expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(false)
		component.save()

		expect(socketService.lastEmit('manage')!.args[0]).toEqual({
			action: 'add',
			type: 'cloud_key',
			key: 'a-cloud-key',
		})
		expect(closed).toBe(true)
	})
})
