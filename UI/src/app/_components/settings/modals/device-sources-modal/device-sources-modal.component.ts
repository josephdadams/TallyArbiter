import { Component, ChangeDetectionStrategy, Input, OnDestroy, computed, inject, signal } from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { Subscription } from 'rxjs'
import { Confirmable } from 'src/app/_decorators/confirmable.decorator'
import { FormErrorComponent } from 'src/app/_forms/form-error.component'
import { nonBlank, selectionMade } from 'src/app/_forms/validators'
import { Device } from 'src/app/_models/Device'
import { DeviceSource } from 'src/app/_models/DeviceSource'
import { Source } from 'src/app/_models/Source'
import { SourceTypeBus } from 'src/app/_models/SourceTypeBus'
import { SocketService } from 'src/app/_services/socket.service'

type DeviceSourceForm = FormGroup<{
	sourceIdx: FormControl<number | null>
	address: FormControl<string>
	bus: FormControl<string | null>
	rename: FormControl<boolean>
}>

@Component({
	selector: 'app-device-sources-modal',
	standalone: true,
	imports: [ReactiveFormsModule, FormErrorComponent],
	templateUrl: './device-sources-modal.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['../../settings.component.scss'],
})
export class DeviceSourcesModalComponent implements OnDestroy {
	public readonly activeModal = inject(NgbActiveModal)
	public readonly socketService = inject(SocketService)

	@Input() device: Device = {} as Device

	/** the row being added or edited; null while the list is showing. a signal so the
	 * OnPush view repaints on its own rather than relying on the click that set it */
	public readonly form = signal<DeviceSourceForm | null>(null)
	private editedDeviceSource: DeviceSource | null = null
	private sourceSubscription?: Subscription

	//`device` never changes for a given modal instance, so reading it inside the
	//computed is enough — the socket signal is what drives recomputation
	public readonly deviceSources = computed(() =>
		this.socketService.deviceSources().filter((obj) => obj.deviceId === this.device.id),
	)

	public ngOnDestroy() {
		this.sourceSubscription?.unsubscribe()
	}

	public getSourceBusOptionsBySourceTypeId(sourceTypeId: string): SourceTypeBus[] {
		return (this.socketService.sourceTypes().find((obj) => obj.id === sourceTypeId)?.busses as SourceTypeBus[]) ?? []
	}

	public get selectedSource(): Source | undefined {
		const index = this.form()?.controls.sourceIdx.value
		if (index === null || index === undefined) return undefined
		return this.socketService.sources()[index]
	}

	/** The addresses the server has seen on the selected source, if any. */
	public get knownAddresses() {
		const source = this.selectedSource
		return source ? (this.socketService.addresses()[source.id] ?? []) : []
	}

	public get busOptions(): SourceTypeBus[] {
		const source = this.selectedSource
		return source ? this.getSourceBusOptionsBySourceTypeId(source.sourceTypeId) : []
	}

	public get isEditingExisting() {
		return this.editedDeviceSource !== null
	}

	public addDeviceSource() {
		this.editedDeviceSource = null
		this.form.set(this.buildForm({} as DeviceSource, null))
	}

	public editDeviceSource(deviceSource: DeviceSource) {
		this.editedDeviceSource = deviceSource
		const sourceIdx = this.socketService.sources().findIndex((s) => s.id == deviceSource.sourceId)
		this.form.set(this.buildForm(deviceSource, sourceIdx === -1 ? null : sourceIdx))
	}

	private buildForm(deviceSource: DeviceSource, sourceIdx: number | null): DeviceSourceForm {
		const form: DeviceSourceForm = new FormGroup({
			sourceIdx: new FormControl<number | null>(sourceIdx, { validators: [selectionMade] }),
			address: new FormControl(deviceSource.address ?? '', { nonNullable: true, validators: [nonBlank] }),
			bus: new FormControl<string | null>(deviceSource.bus ?? null),
			rename: new FormControl(deviceSource.rename ?? false, { nonNullable: true }),
		})

		//asking the server for the source's addresses is what populates the
		//"select or enter manually" dropdown
		this.sourceSubscription?.unsubscribe()
		this.sourceSubscription = form.controls.sourceIdx.valueChanges.subscribe((index) => {
			const source = index === null ? undefined : this.socketService.sources()[index]
			if (source) this.socketService.socket.emit('source_tallydata', source.id)

			//a bus only means something within its own source type
			const busses = source ? this.getSourceBusOptionsBySourceTypeId(source.sourceTypeId) : []
			const bus = form.controls.bus
			bus.setValidators(busses.length > 0 ? [selectionMade] : [])
			if (!busses.some((option) => option.bus === bus.value)) bus.setValue(null, { emitEvent: false })
			bus.updateValueAndValidity()
		})

		if (sourceIdx !== null && this.busOptionsFor(sourceIdx).length > 0) {
			form.controls.bus.setValidators([selectionMade])
			form.controls.bus.updateValueAndValidity()
		}

		return form
	}

	private busOptionsFor(sourceIdx: number): SourceTypeBus[] {
		const source = this.socketService.sources()[sourceIdx]
		return source ? this.getSourceBusOptionsBySourceTypeId(source.sourceTypeId) : []
	}

	public saveDeviceSource() {
		const form = this.form()
		if (!form || form.invalid) return

		const source = this.selectedSource
		if (!source) return

		const { sourceIdx, ...rest } = form.getRawValue()
		const deviceSourceObj = {
			...(this.editedDeviceSource ?? {}),
			deviceId: this.device.id,
			...rest,
			sourceId: source.id,
		} as DeviceSource

		//reset before emitting so the form is blank for the next entry
		this.form.set(null)
		this.editedDeviceSource = null

		this.socketService.socket.emit('manage', {
			action: deviceSourceObj.id !== undefined ? 'edit' : 'add',
			type: 'device_source',
			device_source: deviceSourceObj,
		})
	}

	@Confirmable('Are you sure you want to delete this device source mapping?')
	public deleteDeviceSource(deviceSource: DeviceSource) {
		this.socketService.socket.emit('manage', {
			action: 'delete',
			type: 'device_source',
			device_source: { id: deviceSource.id },
		})
	}
}
