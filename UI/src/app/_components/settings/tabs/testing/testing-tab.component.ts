import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { DevicesTableComponent } from '../../shared/devices-table/devices-table.component'
import { SocketService } from 'src/app/_services/socket.service'

@Component({
	selector: 'app-testing-tab',
	standalone: true,
	imports: [FormsModule, DevicesTableComponent],
	templateUrl: './testing-tab.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestingTabComponent {
	public readonly socketService = inject(SocketService)

	//the server stands up a synthetic source with this id while test mode runs
	public readonly testModeOn = computed(() => this.socketService.sources().some((source) => source.id == 'TEST'))

	public setTestMode(state: boolean, interval: number = 1000) {
		this.socketService.setTestMode(state, interval)
	}
}
