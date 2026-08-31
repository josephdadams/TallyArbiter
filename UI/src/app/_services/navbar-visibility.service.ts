import { Injectable, signal } from '@angular/core'

@Injectable({
	providedIn: 'root',
})
export class NavbarVisibilityService {
	public readonly navbarIsVisible = signal(true)

	public hideNavbar() {
		this.navbarIsVisible.set(false)
	}

	public showNavbar() {
		this.navbarIsVisible.set(true)
	}
}
