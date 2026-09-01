import { Component, ChangeDetectionStrategy, inject } from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { FormErrorComponent } from 'src/app/_forms/form-error.component'
import { nonBlank } from 'src/app/_forms/validators'
import { SocketService } from 'src/app/_services/socket.service'

@Component({
	selector: 'app-cloud-key-modal',
	standalone: true,
	imports: [ReactiveFormsModule, FormErrorComponent],
	templateUrl: './cloud-key-modal.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CloudKeyModalComponent {
	public readonly activeModal = inject(NgbActiveModal)
	private readonly socketService = inject(SocketService)

	public readonly form = new FormGroup({
		key: new FormControl('', { nonNullable: true, validators: [nonBlank] }),
	})

	public save() {
		if (this.form.invalid) return

		this.socketService.socket.emit('manage', {
			action: 'add',
			type: 'cloud_key',
			key: this.form.getRawValue().key,
		})
		this.activeModal.close()
	}
}
