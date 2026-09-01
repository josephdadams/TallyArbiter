import { Component, ChangeDetectionStrategy, Input, OnInit, inject } from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { FormErrorComponent } from 'src/app/_forms/form-error.component'
import { nonBlank } from 'src/app/_forms/validators'
import { CloudDestination } from 'src/app/_models/CloudDestination'
import { SocketService } from 'src/app/_services/socket.service'

@Component({
	selector: 'app-cloud-destination-modal',
	standalone: true,
	imports: [ReactiveFormsModule, FormErrorComponent],
	templateUrl: './cloud-destination-modal.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CloudDestinationModalComponent implements OnInit {
	public readonly activeModal = inject(NgbActiveModal)
	private readonly socketService = inject(SocketService)

	@Input() cloudDestination: CloudDestination = {} as CloudDestination
	@Input() editing = false

	public form!: FormGroup<{
		host: FormControl<string>
		port: FormControl<string>
		key: FormControl<string>
	}>

	public ngOnInit() {
		this.form = new FormGroup({
			host: new FormControl(this.cloudDestination.host ?? '', {
				nonNullable: true,
				validators: [nonBlank],
			}),
			port: new FormControl(this.cloudDestination.port ?? '', {
				nonNullable: true,
				validators: [nonBlank, Validators.min(1), Validators.max(65535)],
			}),
			key: new FormControl(this.cloudDestination.key ?? '', {
				nonNullable: true,
				validators: [nonBlank],
			}),
		})
	}

	public save() {
		if (this.form.invalid) return

		this.socketService.socket.emit('manage', {
			action: this.editing ? 'edit' : 'add',
			type: 'cloud_destination',
			cloudDestination: { ...this.cloudDestination, ...this.form.getRawValue() } as CloudDestination,
		})
	}
}
