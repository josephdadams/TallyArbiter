import { Component } from '@angular/core'
import { SocketService } from 'src/app/_services/socket.service'

@Component({
	selector: 'app-home',
	templateUrl: './home.component.html',
	styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
	public localNetInterfaceUrl = 'http://localhost:4455/#/tally'
	public netInterfaceUrl = this.localNetInterfaceUrl
	constructor(public socketService: SocketService) {}
}
