import { Component, ChangeDetectionStrategy, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { QrCodeModule } from 'ng-qrcode'
import { SocketService } from 'src/app/_services/socket.service'

@Component({
	selector: 'app-home',
	standalone: true,
	imports: [FormsModule, QrCodeModule],
	templateUrl: './home.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
	public readonly socketService = inject(SocketService)

	public localNetInterfaceUrl = 'http://localhost:4455/#/tally'
	public netInterfaceUrl = this.localNetInterfaceUrl
}
