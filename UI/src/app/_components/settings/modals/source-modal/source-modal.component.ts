import { Component, ChangeDetectionStrategy, DestroyRef, Input, OnInit, inject } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormControl, FormGroup, FormRecord, ReactiveFormsModule } from '@angular/forms'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { buildDataFieldRecord } from 'src/app/_forms/data-fields'
import { FormErrorComponent } from 'src/app/_forms/form-error.component'
import { nonBlank, portNotInUse, selectionMade } from 'src/app/_forms/validators'
import { Source } from 'src/app/_models/Source'
import { SourceType } from 'src/app/_models/SourceType'
import { SocketService } from 'src/app/_services/socket.service'
import { TallyInputConfigField } from 'src/app/_types/TallyInputConfigField'

@Component({
	selector: 'app-source-modal',
	standalone: true,
	imports: [ReactiveFormsModule, FormErrorComponent],
	templateUrl: './source-modal.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['../../settings.component.scss'],
})
export class SourceModalComponent implements OnInit {
	public readonly activeModal = inject(NgbActiveModal)
	public readonly socketService = inject(SocketService)
	private readonly destroyRef = inject(DestroyRef)

	@Input() source: Source = {} as Source
	@Input() editing = false
	/** index into socketService.sourceTypes(), because the select binds by index */
	@Input() sourceTypeIdx?: number

	public form!: FormGroup<{
		sourceTypeIdx: FormControl<number | null>
		name: FormControl<string>
		data: FormRecord<FormControl<any>>
		enabled: FormControl<boolean>
		reconnect: FormControl<boolean>
	}>

	public ngOnInit() {
		this.form = new FormGroup({
			sourceTypeIdx: new FormControl<number | null>(
				//the caller may hand us -1 when it could not match the discovered type
				{
					value: this.sourceTypeIdx === undefined || this.sourceTypeIdx === -1 ? null : this.sourceTypeIdx,
					disabled: this.editing,
				},
				{ validators: [selectionMade] },
			),
			name: new FormControl(this.source.name ?? '', { nonNullable: true, validators: [nonBlank] }),
			data: this.buildDataRecord(this.source.data),
			enabled: new FormControl(this.source.enabled ?? false, { nonNullable: true }),
			reconnect: new FormControl(this.source.reconnect ?? false, { nonNullable: true }),
		})

		//the type is fixed once a source exists, so this only fires while adding
		this.form.controls.sourceTypeIdx.valueChanges
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe(() => this.rebuildDataRecord())
	}

	public get selectedSourceType(): SourceType | undefined {
		const index = this.form?.controls.sourceTypeIdx.value
		if (index === null || index === undefined) return undefined
		return this.socketService.sourceTypes()[index]
	}

	public getOptionFields(sourceType: SourceType | undefined): TallyInputConfigField[] {
		if (!sourceType) return []
		return this.socketService.sourceTypeDataFields().find((s) => s.sourceTypeId == sourceType.id)?.fields || []
	}

	/**
	 * Track key for the dynamic field rows. Keyed by source type as well as field
	 * name: switching type replaces the whole `data` record, and two types can
	 * share a field name ("ip", "port"); tracking by name alone would let @for
	 * reuse the row, leaving its formControlName directive bound to a control
	 * that is no longer in the form.
	 */
	public dataFieldKey(field: TallyInputConfigField): string {
		return `${this.selectedSourceType?.id}/${field.fieldName}`
	}

	/** Narrows the record's control for the template, which cannot index a FormRecord safely. */
	public dataControl(fieldName: string): FormControl<any> | null {
		return this.form.controls.data.get(fieldName) as FormControl<any> | null
	}

	private buildDataRecord(data: Record<string, any> | undefined) {
		return buildDataFieldRecord(this.getOptionFields(this.selectedSourceTypeFor(this.currentIdx())), data, {
			enforceRequired: true,
			extraValidators: (field) =>
				field.fieldType === 'port' ? [portNotInUse(this.socketService.portsInUse, () => this.source.id)] : [],
		})
	}

	//`selectedSourceType` reads through the form, which does not exist yet while the
	//group is being constructed, so building the initial record goes through these
	private currentIdx(): number | null {
		if (this.form) return this.form.controls.sourceTypeIdx.value
		return this.sourceTypeIdx === undefined || this.sourceTypeIdx === -1 ? null : this.sourceTypeIdx
	}

	private selectedSourceTypeFor(index: number | null): SourceType | undefined {
		return index === null ? undefined : this.socketService.sourceTypes()[index]
	}

	//switching type keeps anything already typed under a field name the new type
	//also has, which is what makes "add from discovered device" prefill work
	private rebuildDataRecord() {
		const carried = { ...this.source.data, ...this.form.controls.data.getRawValue() }
		this.form.setControl('data', this.buildDataRecord(carried))
	}

	public save() {
		if (this.form.invalid) return

		const sourceType = this.selectedSourceType
		if (!sourceType) return

		const { sourceTypeIdx, data, ...rest } = this.form.getRawValue()
		const sourceObj = {
			...this.source,
			...rest,
			//keys the descriptor does not cover (a discovered device carries extras)
			//are preserved rather than dropped
			data: { ...this.source.data, ...data },
			sourceTypeId: sourceType.id,
		} as any
		if (!this.editing) {
			sourceObj.reconnect = true
			sourceObj.enabled = true
		}

		this.socketService.socket.emit('manage', {
			action: this.editing ? 'edit' : 'add',
			type: 'source',
			source: sourceObj,
		})
	}
}
