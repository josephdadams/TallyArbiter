import { ChangeDetectionStrategy, ChangeDetectorRef, Component, effect, inject, input } from '@angular/core'
import { AbstractControl } from '@angular/forms'

/**
 * Inline validation message for a single control, shown once the user has had a
 * chance to fill the field in (touched or dirty) so a freshly opened modal is
 * not covered in red.
 *
 * The control object itself never changes identity, so an OnPush view would not
 * re-render as the control's validity changes; subscribing to `events` (which
 * covers value, status *and* touched transitions) is what keeps it in step.
 */
@Component({
	selector: 'app-form-error',
	standalone: true,
	template: `
		@if (message(); as text) {
			<div class="invalid-feedback d-block">{{ text }}</div>
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormErrorComponent {
	public readonly control = input.required<AbstractControl | null | undefined>()
	/** Used to word the message, e.g. "Source Name is required." */
	public readonly label = input('This field')

	private readonly changeDetector = inject(ChangeDetectorRef)

	constructor() {
		effect((onCleanup) => {
			const control = this.control()
			if (!control) return
			const subscription = control.events.subscribe(() => this.changeDetector.markForCheck())
			onCleanup(() => subscription.unsubscribe())
		})
	}

	public message(): string | null {
		const control = this.control()
		if (!control || !control.errors || !(control.touched || control.dirty)) return null

		const errors = control.errors
		const label = this.label()

		if (errors['required']) return `${label} is required.`
		if (errors['minlength']) {
			return `${label} must be at least ${errors['minlength'].requiredLength} characters long.`
		}
		if (errors['min'] !== undefined && errors['max'] === undefined) {
			return `${label} must be ${errors['min'].min} or more.`
		}
		if (errors['max'] !== undefined) return `${label} must be ${errors['max'].max} or less.`
		if (errors['portInUse']) return 'This port is already in use. Please pick another!'

		return `${label} is not valid.`
	}
}
