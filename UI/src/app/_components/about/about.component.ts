import { CommonModule } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { SocketService } from 'src/app/_services/socket.service'

@Component({
	selector: 'app-about',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './about.component.html',
	styleUrls: ['./about.component.scss'],
})
export class AboutComponent implements OnInit {
	public currentYear = new Date().getFullYear()

	constructor(public socketService: SocketService) {}

	ngOnInit(): void {}
}