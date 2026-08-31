import { Component, ChangeDetectionStrategy, Input, OnInit, inject } from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { FormErrorComponent } from 'src/app/_forms/form-error.component'
import { nonBlank } from 'src/app/_forms/validators'
import { TSLClient } from 'src/app/_models/TSLClient'
import { SocketService } from 'src/app/_services/socket.service'

/** Defaults for a brand new client, and the floor for an existing one. */
export function normalizeTSLClient(client: any): any {
	const out = { ...client }

	//if protocol is missing, default to "3.1"
	out.protocol ??= '3.1'

	//if transport is missing, default to "udp"
	out.transport ??= 'udp'

	out.protocolOptions ??= {}
	out.protocolOptions.brightness ??= 3

	// 3.1 default mapping
	out.protocolOptions.tally1 ??= 'pvw'
	out.protocolOptions.tally2 ??= 'pgm'
	out.protocolOptions.tally3 ??= 'off'
	out.protocolOptions.tally4 ??= 'off'

	// 5.0 default mapping
	out.protocolOptions.lh_tally ??= 'pgm'
	out.protocolOptions.rh_tally ??= 'pvw'
	out.protocolOptions.text_tally ??= 'off'
	out.protocolOptions.sequence ??= 'ON'

	return out
}

export function createDefaultTSLClient(): any {
	return normalizeTSLClient({ ip: '127.0.0.1', port: 5720 })
}

@Component({
	selector: 'app-tsl-client-modal',
	standalone: true,
	imports: [ReactiveFormsModule, FormErrorComponent],
	templateUrl: './tsl-client-modal.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['../../settings.component.scss'],
})
export class TslClientModalComponent implements OnInit {
	public readonly activeModal = inject(NgbActiveModal)
	private readonly socketService = inject(SocketService)

	@Input() tslClient: TSLClient = createDefaultTSLClient() as TSLClient
	@Input() editing = false

	public form!: FormGroup<{
		ip: FormControl<string>
		port: FormControl<number | string | null>
		transport: FormControl<string>
		protocol: FormControl<string>
		protocolOptions: FormGroup<{
			tally1: FormControl<string>
			tally2: FormControl<string>
			tally3: FormControl<string>
			tally4: FormControl<string>
			lh_tally: FormControl<string>
			rh_tally: FormControl<string>
			text_tally: FormControl<string>
			sequence: FormControl<string>
			brightness: FormControl<number>
		}>
	}>

	public ngOnInit() {
		//both callers normalize before handing the client over, so every protocol
		//option already has a value; the group carries the 3.1 and 5.0 sets at once
		//and the template shows whichever the selected protocol uses
		const client = normalizeTSLClient(this.tslClient)
		const options = client.protocolOptions

		this.form = new FormGroup({
			ip: new FormControl(client.ip ?? '', { nonNullable: true, validators: [nonBlank] }),
			port: new FormControl<number | string | null>(client.port ?? null, {
				validators: [nonBlank, Validators.min(1), Validators.max(65535)],
			}),
			transport: new FormControl(client.transport, { nonNullable: true, validators: [nonBlank] }),
			protocol: new FormControl(client.protocol, { nonNullable: true, validators: [nonBlank] }),
			protocolOptions: new FormGroup({
				tally1: new FormControl(options.tally1, { nonNullable: true }),
				tally2: new FormControl(options.tally2, { nonNullable: true }),
				tally3: new FormControl(options.tally3, { nonNullable: true }),
				tally4: new FormControl(options.tally4, { nonNullable: true }),
				lh_tally: new FormControl(options.lh_tally, { nonNullable: true }),
				rh_tally: new FormControl(options.rh_tally, { nonNullable: true }),
				text_tally: new FormControl(options.text_tally, { nonNullable: true }),
				sequence: new FormControl(options.sequence, { nonNullable: true }),
				brightness: new FormControl(options.brightness, { nonNullable: true }),
			}),
		})
	}

	public save() {
		if (this.form.invalid) return

		this.socketService.socket.emit('manage', {
			action: this.editing ? 'edit' : 'add',
			type: 'tsl_client',
			tslClient: { ...this.tslClient, ...this.form.getRawValue() } as TSLClient,
		})
	}
}
