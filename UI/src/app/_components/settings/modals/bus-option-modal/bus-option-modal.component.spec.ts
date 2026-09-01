import { ComponentFixture, TestBed } from '@angular/core/testing'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

import { BusOption } from 'src/app/_models/BusOption'
import { SocketService } from 'src/app/_services/socket.service'
import { SocketServiceStub } from 'src/app/_testing/socket-service.stub'
import { BusOptionModalComponent } from './bus-option-modal.component'

describe('BusOptionModalComponent', () => {
	let fixture: ComponentFixture<BusOptionModalComponent>
	let component: BusOptionModalComponent
	let socketService: SocketServiceStub

	beforeEach(async () => {
		socketService = new SocketServiceStub()

		await TestBed.configureTestingModule({
			imports: [BusOptionModalComponent],
			providers: [
				{ provide: SocketService, useValue: socketService },
				{ provide: NgbActiveModal, useValue: { close: () => {}, dismiss: () => {} } },
			],
		}).compileComponents()

		fixture = TestBed.createComponent(BusOptionModalComponent)
		component = fixture.componentInstance
		component.busOption = { id: 'b1', label: 'Preview', type: 'preview', color: '#00ff00', visible: true } as BusOption
		component.editing = true
		fixture.detectChanges()
	})

	it('shows label and type but does not let them be edited', () => {
		expect(component.form.controls.label.disabled).toBe(true)
		expect(component.form.controls.type.disabled).toBe(true)
		expect(fixture.nativeElement.querySelector('#busLabel').disabled).toBe(true)
	})

	it('still sends the disabled label and type on save', () => {
		component.form.controls.color.setValue('#ff0000')
		component.form.controls.visible.setValue(false)
		component.save()

		const payload = socketService.lastEmit('manage')!.args[0]
		expect(payload.action).toBe('edit')
		expect(payload.busOption.label).toBe('Preview')
		expect(payload.busOption.type).toBe('preview')
		expect(payload.busOption.color).toBe('#ff0000')
		expect(payload.busOption.visible).toBe(false)
	})
})
