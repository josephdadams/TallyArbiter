import { Component, ChangeDetectionStrategy, Input, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
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
	imports: [FormsModule],
	templateUrl: './tsl-client-modal.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['../../settings.component.scss'],
})
export class TslClientModalComponent {
	public readonly activeModal = inject(NgbActiveModal)
	private readonly socketService = inject(SocketService)

	@Input() tslClient: TSLClient = createDefaultTSLClient() as TSLClient
	@Input() editing = false

	public onProtocolChanged(protocol: '3.1' | '5.0') {
		const options = ((this.tslClient as any).protocolOptions ??= {})

		if (protocol === '3.1') {
			options.tally1 ??= 'pvw'
			options.tally2 ??= 'pgm'
			options.tally3 ??= 'off'
			options.tally4 ??= 'off'
		} else {
			options.lh_tally ??= 'pgm'
			options.rh_tally ??= 'pvw'
			options.text_tally ??= 'pgm'
			options.sequence ??= 'ON'
		}

		options.brightness ??= 3
	}

	public save() {
		this.socketService.socket.emit('manage', {
			action: this.editing ? 'edit' : 'add',
			type: 'tsl_client',
			tslClient: { ...this.tslClient } as TSLClient,
		})
	}
}
