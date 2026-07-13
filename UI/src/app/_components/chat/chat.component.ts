import { CommonModule } from '@angular/common'
import { Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Subscription } from 'rxjs'
import { SocketService } from 'src/app/_services/socket.service'

@Component({
	selector: 'app-chat',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './chat.component.html',
	styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements OnDestroy {
	public message = ''
	@Input() type: 'producer' | any
	@ViewChild('chatContainer') private chatContainer!: ElementRef

	private scrollChatSubscription: Subscription

	constructor(public socketService: SocketService) {
		this.scrollChatSubscription = this.socketService.scrollChatSubject.subscribe(() => {
			this.scrollToBottom(this.chatContainer)
		})
	}

	ngOnDestroy(): void {
		this.scrollChatSubscription?.unsubscribe()
	}

	public sendMessage(): void {
		if (!this.message.trim()) {
			return
		}
		this.message = this.message.trim()
		this.socketService.socket.emit('messaging', this.type, this.message)
		this.message = ''
	}

	private scrollToBottom(e: ElementRef) {
		setTimeout(() => {
			try {
				e.nativeElement.scrollTop = e.nativeElement.scrollHeight
			} catch {}
		})
	}
}
