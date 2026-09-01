import { Component, ChangeDetectionStrategy, Input, OnInit, inject } from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { FormErrorComponent } from 'src/app/_forms/form-error.component'
import { nonBlank } from 'src/app/_forms/validators'
import { Device } from 'src/app/_models/Device'
import { SocketService } from 'src/app/_services/socket.service'

/** TSL addresses are a single byte with 126 reserved as the ceiling. */
const TSL_ADDRESS_MAX = 126

@Component({
	selector: 'app-device-modal',
	standalone: true,
	imports: [ReactiveFormsModule, FormErrorComponent],
	templateUrl: './device-modal.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['../../settings.component.scss'],
})
export class DeviceModalComponent implements OnInit {
	public readonly activeModal = inject(NgbActiveModal)
	public readonly socketService = inject(SocketService)

	@Input() device: Device = {} as Device
	@Input() editing = false

	public readonly tslAddressMax = TSL_ADDRESS_MAX

	public form!: FormGroup<{
		name: FormControl<string>
		description: FormControl<string>
		tslAddress: FormControl<string | number | null>
		cameraIP: FormControl<string>
		cameraModel: FormControl<string>
		linkedBusses: FormControl<string[]>
		enabled: FormControl<boolean>
	}>

	public ngOnInit() {
		this.form = new FormGroup({
			name: new FormControl(this.device.name ?? '', { nonNullable: true, validators: [nonBlank] }),
			description: new FormControl(this.device.description ?? '', { nonNullable: true }),
			//optional, but an out-of-range address used to be silently clamped on save;
			//it is now rejected with a message so the user sees what happened
			tslAddress: new FormControl<string | number | null>(this.device.tslAddress ?? null, {
				validators: [Validators.min(0), Validators.max(TSL_ADDRESS_MAX)],
			}),
			cameraIP: new FormControl(this.device.cameraIP ?? '', { nonNullable: true }),
			cameraModel: new FormControl(this.device.cameraModel ?? '', { nonNullable: true }),
			linkedBusses: new FormControl(this.device.linkedBusses ?? [], { nonNullable: true }),
			enabled: new FormControl(this.device.enabled ?? false, { nonNullable: true }),
		})
	}

	public save() {
		if (this.form.invalid) return

		const { tslAddress, ...rest } = this.form.getRawValue()
		const deviceObj = {
			...this.device,
			...rest,
			tslAddress: tslAddress === null ? '' : `${tslAddress}`,
		} as Device
		if (!this.editing) {
			deviceObj.enabled = true
		}

		this.socketService.socket.emit('manage', {
			action: this.editing ? 'edit' : 'add',
			type: 'device',
			device: deviceObj,
		})
	}
}
