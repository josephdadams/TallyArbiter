import { Injectable } from '@angular/core'
import NoSleep from 'nosleep.js'

@Injectable({
	providedIn: 'root',
})
export class WakeLockService {
	private noSleep?: NoSleep
	public init() {
		this.noSleep = new NoSleep()
		document.addEventListener('click', () => this.enableWakeLock())
	}

	private enableWakeLock() {
		document.removeAllListeners?.('click')
		this.noSleep?.enable()
	}
}
