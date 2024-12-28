import { Component, ElementRef, Input, ViewChild } from '@angular/core'
import { SocketService } from 'src/app/_services/socket.service'

@Component({
	selector: 'app-chat',
	templateUrl: './chat.component.html',
	styleUrls: ['./chat.component.scss'],
})
export class ChatComponent {
	public message = ''
	@Input() type: 'producer' | any
	@ViewChild('chatContainer') private chatContainer!: ElementRef
	constructor(public socketService: SocketService) {
		this.socketService.scrollChatSubject.subscribe(() => {
			this.scrollToBottom(this.chatContainer)
		})
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
