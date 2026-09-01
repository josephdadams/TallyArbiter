import { Component, ChangeDetectionStrategy, Input, OnInit, inject } from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { FormErrorComponent } from 'src/app/_forms/form-error.component'
import { nonBlank } from 'src/app/_forms/validators'
import { BusOption } from 'src/app/_models/BusOption'
import { SocketService } from 'src/app/_services/socket.service'

@Component({
	selector: 'app-bus-option-modal',
	standalone: true,
	imports: [ReactiveFormsModule, FormErrorComponent],
	templateUrl: './bus-option-modal.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['../../settings.component.scss'],
})
export class BusOptionModalComponent implements OnInit {
	public readonly activeModal = inject(NgbActiveModal)
	private readonly socketService = inject(SocketService)

	@Input() busOption: BusOption = {} as BusOption
	@Input() editing = false

	public form!: FormGroup<{
		label: FormControl<string>
		type: FormControl<string>
		color: FormControl<string>
		visible: FormControl<boolean>
	}>

	public ngOnInit() {
		this.form = new FormGroup({
			//label and type describe the bus the server defined; they are shown for
			//context and have never been editable here
			label: new FormControl({ value: this.busOption.label ?? '', disabled: true }, { nonNullable: true }),
			type: new FormControl({ value: this.busOption.type ?? '', disabled: true }, { nonNullable: true }),
			color: new FormControl(this.busOption.color ?? '#000000', {
				nonNullable: true,
				validators: [nonBlank],
			}),
			visible: new FormControl(this.busOption.visible ?? true, { nonNullable: true }),
		})
	}

	public save() {
		if (this.form.invalid) return

		this.socketService.socket.emit('manage', {
			action: this.editing ? 'edit' : 'add',
			type: 'bus_option',
			//getRawValue, not value: label and type are disabled controls and the
			//server still expects them on the payload
			busOption: { ...this.busOption, ...this.form.getRawValue() } as any,
		})
	}
}
