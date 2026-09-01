import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms'
import { Signal } from '@angular/core'
import { Port } from 'src/app/_models/Port'

/**
 * Required, but a value of only whitespace counts as missing. Matches the
 * `value.toString().trim().length === 0` test the modals used to run by hand
 * inside save(), which `Validators.required` on its own does not (it accepts
 * '   ' for a string control).
 */
export function nonBlank(control: AbstractControl): ValidationErrors | null {
	const value = control.value
	if (value === null || value === undefined) return { required: true }
	if (Array.isArray(value)) return value.length === 0 ? { required: true } : null
	return value.toString().trim().length === 0 ? { required: true } : null
}

/**
 * A selection has to have been made. Unlike {@link nonBlank} an empty string is
 * a legitimate value here, because dropdowns are allowed to offer one (the
 * Generic UDP action's End Character field uses '' for "None").
 */
export function selectionMade(control: AbstractControl): ValidationErrors | null {
	return control.value === null || control.value === undefined ? { required: true } : null
}

/**
 * A port already claimed by a *different* source is a conflict; this source
 * keeping its own port is fine.
 */
export function portNotInUse(portsInUse: Signal<Port[]>, ownSourceId: () => string | undefined): ValidatorFn {
	return (control: AbstractControl): ValidationErrors | null => {
		const value = control.value
		if (value === null || value === undefined || value.toString().trim().length === 0) return null

		const sourceId = ownSourceId()
		const conflict = portsInUse().some(
			(port) => port.port.toString() === value.toString() && port.sourceId !== sourceId,
		)
		return conflict ? { portInUse: true } : null
	}
}
