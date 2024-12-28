import { Injectable } from '@angular/core'

@Injectable({
	providedIn: 'root',
})
export class connLostSnackbarService {
	public visible = false

	public hide() {
		this.visible = false
	}

	public show() {
		this.visible = true
	}
}
