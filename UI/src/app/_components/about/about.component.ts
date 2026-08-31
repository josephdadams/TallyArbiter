import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core'
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
	public readonly socketService = inject(SocketService)

	public currentYear = new Date().getFullYear()

	ngOnInit(): void {}
}
