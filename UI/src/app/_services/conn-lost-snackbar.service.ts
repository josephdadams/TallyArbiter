import { Injectable, signal } from '@angular/core'

@Injectable({
	providedIn: 'root',
})
export class connLostSnackbarService {
	//shown from a socket disconnect handler, so it has to notify
	public readonly visible = signal(false)

	public hide() {
		this.visible.set(false)
	}

	public show() {
		this.visible.set(true)
	}
}
