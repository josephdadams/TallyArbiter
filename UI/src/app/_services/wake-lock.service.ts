import { Injectable } from '@angular/core'
import NoSleep from 'nosleep.js'

@Injectable({
	providedIn: 'root',
})
export class WakeLockService {
	private noSleep?: NoSleep
	private clickHandler = () => this.enableWakeLock()

	public init() {
		this.noSleep = new NoSleep()
		document.addEventListener('click', this.clickHandler)
	}

	private enableWakeLock() {
		document.removeEventListener('click', this.clickHandler)
		this.noSleep?.enable()
	}
}
