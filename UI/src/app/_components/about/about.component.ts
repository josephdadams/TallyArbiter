import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core'
import { SocketService } from 'src/app/_services/socket.service'

@Component({
	selector: 'app-about',
	standalone: true,
	imports: [],
	templateUrl: './about.component.html',
	changeDetection: ChangeDetectionStrategy.Eager,
	styleUrls: ['./about.component.scss'],
})
export class AboutComponent implements OnInit {
	public currentYear = new Date().getFullYear()

	constructor(public socketService: SocketService) {}

	ngOnInit(): void {}
}
