import { Component, ChangeDetectionStrategy, Input, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import Swal from 'sweetalert2'
import { Source } from 'src/app/_models/Source'
import { SourceType } from 'src/app/_models/SourceType'
import { SocketService } from 'src/app/_services/socket.service'

const globalSwalOptions = {
	confirmButtonColor: '#2a70c7',
}

@Component({
	selector: 'app-source-modal',
	standalone: true,
	imports: [FormsModule],
	templateUrl: './source-modal.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['../../settings.component.scss'],
})
export class SourceModalComponent {
	public readonly activeModal = inject(NgbActiveModal)
	public readonly socketService = inject(SocketService)

	@Input() source: Source = {} as Source
	@Input() editing = false
	/** index into socketService.sourceTypes(), because the select binds by index */
	@Input() sourceTypeIdx?: number

	public getOptionFields(sourceType: SourceType) {
		return this.socketService.sourceTypeDataFields().find((s) => s.sourceTypeId == sourceType.id)?.fields || []
	}

	//a port already claimed by a *different* source is a conflict; this source
	//keeping its own port is fine
	private portInUse(portToCheck: number, sourceId: string) {
		return this.socketService
			.portsInUse()
			.some((port) => port.port.toString() === portToCheck.toString() && port.sourceId !== sourceId)
	}

	private error(text: string) {
		Swal.fire({ icon: 'error', text, title: 'Error', ...globalSwalOptions })
	}

	public save() {
		if (!this.source.name || this.source.name.toString().trim().length === 0) {
			return this.error('The Source needs a name!')
		}

		const sourceTypeIdx = this.sourceTypeIdx
		if (sourceTypeIdx === undefined || sourceTypeIdx === -1 || !this.socketService.sourceTypes()[sourceTypeIdx]) {
			return this.error('Please select a source type!')
		}

		for (const field of this.getOptionFields(this.socketService.sourceTypes()[sourceTypeIdx])) {
			const value = this.source.data[field.fieldName]

			if (field.fieldName != 'info' && !field.optional) {
				if (value === null || value === undefined || value.toString().trim().length === 0) {
					return this.error('Not all fields filled out!')
				}
			}
			if (field.fieldType == 'port' && this.portInUse(value, this.source.id)) {
				return this.error('This port is already in use. Please pick another!')
			}
		}

		const sourceObj = {
			...this.source,
			sourceTypeId: this.socketService.sourceTypes()[sourceTypeIdx].id,
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
