import { ComponentFixture, TestBed } from '@angular/core/testing'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

import { CloudDestination } from 'src/app/_models/CloudDestination'
import { SocketService } from 'src/app/_services/socket.service'
import { SocketServiceStub } from 'src/app/_testing/socket-service.stub'
import { CloudDestinationModalComponent } from './cloud-destination-modal.component'

describe('CloudDestinationModalComponent', () => {
	let fixture: ComponentFixture<CloudDestinationModalComponent>
	let component: CloudDestinationModalComponent
	let socketService: SocketServiceStub

	beforeEach(async () => {
		socketService = new SocketServiceStub()

		await TestBed.configureTestingModule({
			imports: [CloudDestinationModalComponent],
			providers: [
				{ provide: SocketService, useValue: socketService },
				{ provide: NgbActiveModal, useValue: { close: () => {}, dismiss: () => {} } },
			],
		}).compileComponents()

		fixture = TestBed.createComponent(CloudDestinationModalComponent)
		component = fixture.componentInstance
	})

	function createFor(cloudDestination: Partial<CloudDestination>, editing = false) {
		component.cloudDestination = cloudDestination as CloudDestination
		component.editing = editing
		fixture.detectChanges()
	}

	it('requires host, port and key when adding', () => {
		createFor({})

		expect(component.form.controls.host.errors).toEqual({ required: true })
		expect(component.form.controls.port.errors).toEqual({ required: true })
		expect(component.form.controls.key.errors).toEqual({ required: true })
		expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true)
	})

	it('rejects a port outside the valid range and explains why', () => {
		createFor({ host: 'cloud.example', key: 'k', port: '80' })
		component.form.controls.port.setValue('70000')
		component.form.controls.port.markAsTouched()
		fixture.detectChanges()

		expect(component.form.invalid).toBe(true)
		expect(fixture.nativeElement.textContent).toContain('Port must be 65535 or less.')
	})

	it('emits an edit that keeps the existing id', () => {
		createFor({ id: 'cd-1', host: 'cloud.example', port: '8080', key: 'secret' }, true)
		component.form.controls.host.setValue('other.example')
		component.save()

		const payload = socketService.lastEmit('manage')!.args[0]
		expect(payload.action).toBe('edit')
		expect(payload.cloudDestination.id).toBe('cd-1')
		expect(payload.cloudDestination.host).toBe('other.example')
	})
})
