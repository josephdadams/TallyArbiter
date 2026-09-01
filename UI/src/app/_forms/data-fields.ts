import { FormControl, FormRecord, ValidatorFn } from '@angular/forms'
import { TallyInputConfigField } from 'src/app/_types/TallyInputConfigField'
import { nonBlank, selectionMade } from './validators'

export interface DataFieldRecordOptions {
	/**
	 * Apply a required validator to every field the descriptor does not mark
	 * `optional`. Sources have always enforced this; device actions never have,
	 * so they opt out and keep their fields free-form.
	 */
	enforceRequired?: boolean
	/** Per-field extras, e.g. the port-in-use check sources run on `port` fields. */
	extraValidators?: (field: TallyInputConfigField) => ValidatorFn[]
}

/** `info` fields are static help text, so they never get a control. */
export function editableDataFields(fields: TallyInputConfigField[]): TallyInputConfigField[] {
	return fields.filter((field) => field.fieldType !== 'info')
}

function initialValue(field: TallyInputConfigField, existing: unknown) {
	if (field.fieldType === 'multiselect') return Array.isArray(existing) ? existing : []
	if (field.fieldType === 'bool') return existing ?? false
	return existing ?? null
}

function requiredValidator(field: TallyInputConfigField): ValidatorFn[] {
	if (field.optional) return []
	//a dropdown may legitimately offer an empty-string option (the Generic UDP
	//action's End Character uses '' for "None"), so it only has to be answered
	return field.fieldType === 'dropdown' ? [selectionMade] : [nonBlank]
}

/**
 * Builds the form for the type-specific `data` block that source types and
 * output types describe at runtime through
 * `socketService.sourceTypeDataFields()` / `outputTypeDataFields()`.
 */
export function buildDataFieldRecord(
	fields: TallyInputConfigField[],
	data: Record<string, any> | undefined,
	options: DataFieldRecordOptions = {},
): FormRecord<FormControl<any>> {
	const record = new FormRecord<FormControl<any>>({})

	for (const field of editableDataFields(fields)) {
		const validators = [
			...(options.enforceRequired ? requiredValidator(field) : []),
			...(options.extraValidators?.(field) ?? []),
		]
		record.addControl(field.fieldName, new FormControl(initialValue(field, data?.[field.fieldName]), validators))
	}

	return record
}
