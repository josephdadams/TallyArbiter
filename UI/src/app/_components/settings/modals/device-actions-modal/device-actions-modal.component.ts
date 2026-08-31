import { Component, ChangeDetectionStrategy, Input, OnDestroy, computed, inject, signal } from '@angular/core'
import { Subscription } from 'rxjs'
import { FormControl, FormGroup, FormRecord, ReactiveFormsModule } from '@angular/forms'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { Confirmable } from 'src/app/_decorators/confirmable.decorator'
import { buildDataFieldRecord } from 'src/app/_forms/data-fields'
import { FormErrorComponent } from 'src/app/_forms/form-error.component'
import { selectionMade } from 'src/app/_forms/validators'
import { BusOption } from 'src/app/_models/BusOption'
import { Device } from 'src/app/_models/Device'
import { DeviceAction } from 'src/app/_models/DeviceAction'
import { OutputType } from 'src/app/_models/OutputType'
import { SocketService } from 'src/app/_services/socket.service'
import { TallyInputConfigField } from 'src/app/_types/TallyInputConfigField'

type DeviceActionForm = FormGroup<{
	busId: FormControl<string | null>
	active: FormControl<boolean | null>
	outputTypeIdx: FormControl<number | null>
	data: FormRecord<FormControl<any>>
}>

@Component({
	selector: 'app-device-actions-modal',
	standalone: true,
	imports: [ReactiveFormsModule, FormErrorComponent],
	templateUrl: './device-actions-modal.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['../../settings.component.scss'],
})
export class DeviceActionsModalComponent implements OnDestroy {
	public readonly activeModal = inject(NgbActiveModal)
	public readonly socketService = inject(SocketService)

	@Input() device: Device = {} as Device

	/** the row being added or edited; null while the list is showing. a signal so the
	 * OnPush view repaints on its own rather than relying on the click that set it */
	public readonly form = signal<DeviceActionForm | null>(null)
	private editedActionId?: string
	/** whatever the edited row already held, so keys outside the descriptor survive a save */
	private editedActionData: Record<string, any> = {}
	private outputTypeSubscription?: Subscription

	//`device` never changes for a given modal instance, so reading it inside the
	//computed is enough — the socket signal is what drives recomputation
	public readonly deviceActions = computed(() =>
		this.socketService.deviceActions().filter((obj) => obj.deviceId === this.device.id),
	)

	public getOutputOptionFields(outputType: OutputType | undefined): TallyInputConfigField[] {
		if (!outputType) return []
		return this.socketService.outputTypeDataFields().find((t) => t.outputTypeId == outputType.id)?.fields || []
	}

	public getOutputTypeById(outputTypeId: string) {
		return this.socketService.outputTypes().find(({ id }) => id === outputTypeId)
	}

	public getBusById(busId: string): BusOption | undefined {
		return this.socketService.busOptions().find(({ id }) => id === busId)
	}

	public get selectedOutputType(): OutputType | undefined {
		const index = this.form()?.controls.outputTypeIdx.value
		if (index === null || index === undefined) return undefined
		return this.socketService.outputTypes()[index]
	}

	/**
	 * Track key for the dynamic field rows. Keyed by output type as well as field
	 * name: switching type replaces the whole `data` record, and two types can
	 * share a field name ("ip", "port"); tracking by name alone would let @for
	 * reuse the row, leaving its formControlName directive bound to a control
	 * that is no longer in the form.
	 */
	public dataFieldKey(field: TallyInputConfigField): string {
		return `${this.selectedOutputType?.id}/${field.fieldName}`
	}

	/** Narrows the record's control for the template, which cannot index a FormRecord safely. */
	public dataControl(fieldName: string): FormControl<any> | null {
		return (this.form()?.controls.data.get(fieldName) as FormControl<any> | null) ?? null
	}

	public addDeviceAction() {
		this.editedActionId = undefined
		this.editedActionData = {}
		this.form.set(this.buildForm({} as DeviceAction, null))
	}

	public editDeviceAction(deviceAction: DeviceAction) {
		this.editedActionId = deviceAction.id
		this.editedActionData = { ...deviceAction.data }
		const outputTypeIdx = this.socketService.outputTypes().findIndex((t) => t.id == deviceAction.outputTypeId)
		this.form.set(this.buildForm(deviceAction, outputTypeIdx === -1 ? null : outputTypeIdx))
	}

	private buildForm(deviceAction: DeviceAction, outputTypeIdx: number | null): DeviceActionForm {
		const fields = this.getOutputOptionFields(
			outputTypeIdx === null ? undefined : this.socketService.outputTypes()[outputTypeIdx],
		)

		const form: DeviceActionForm = new FormGroup({
			busId: new FormControl<string | null>(deviceAction.busId ?? null, { validators: [selectionMade] }),
			active: new FormControl<boolean | null>(deviceAction.active ?? null, { validators: [selectionMade] }),
			outputTypeIdx: new FormControl<number | null>(outputTypeIdx, { validators: [selectionMade] }),
			//output types have never required their own fields be filled in, so the
			//record carries no validators of its own
			data: buildDataFieldRecord(fields, deviceAction.data),
		})

		this.outputTypeSubscription?.unsubscribe()
		this.outputTypeSubscription = form.controls.outputTypeIdx.valueChanges.subscribe((index) => {
			const carried = { ...this.editedActionData, ...form.controls.data.getRawValue() }
			const nextFields = this.getOutputOptionFields(
				index === null ? undefined : this.socketService.outputTypes()[index],
			)
			form.setControl('data', buildDataFieldRecord(nextFields, carried))
		})

		return form
	}

	public ngOnDestroy() {
		this.outputTypeSubscription?.unsubscribe()
	}

	public get isEditingExisting() {
		return this.editedActionId !== undefined
	}

	public saveDeviceAction() {
		const form = this.form()
		if (!form || form.invalid) return

		const outputType = this.selectedOutputType
		if (!outputType) return

		const { outputTypeIdx, data, ...rest } = form.getRawValue()
		const deviceActionObj = {
			...(this.editedActionId !== undefined ? { id: this.editedActionId } : {}),
			deviceId: this.device.id,
			...rest,
			//keys the descriptor does not cover are preserved rather than dropped
			data: { ...this.editedActionData, ...data },
			outputTypeId: outputType.id,
		} as DeviceAction

		this.form.set(null)

		this.socketService.socket.emit('manage', {
			action: this.editedActionId !== undefined ? 'edit' : 'add',
			type: 'device_action',
			device_action: deviceActionObj,
		})
	}

	public duplicateDeviceAction(deviceAction: DeviceAction) {
		this.socketService.socket.emit('manage', {
			action: 'duplicate',
			type: 'device_action',
			device_action: { id: deviceAction.id },
		})
	}

	@Confirmable('Are you sure you want to delete this action?')
	public deleteDeviceAction(deviceAction: DeviceAction) {
		this.socketService.socket.emit('manage', {
			action: 'delete',
			type: 'device_action',
			device_action: { id: deviceAction.id },
		})
	}
}
