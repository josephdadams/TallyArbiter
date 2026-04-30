import { CommonModule } from '@angular/common'
import { Component } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { QrCodeModule } from 'ng-qrcode'
import { SocketService } from 'src/app/_services/socket.service'

@Component({
	selector: 'app-home',
	standalone: true,
	imports: [CommonModule, FormsModule, QrCodeModule],
	templateUrl: './home.component.html',
	styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
	public localNetInterfaceUrl = 'http://localhost:4455/#/tally'
	public netInterfaceUrl = this.localNetInterfaceUrl

	constructor(public socketService: SocketService) {}
}