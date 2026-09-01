import { Injectable, inject } from '@angular/core'
import { Location } from '@angular/common'
import { Router, NavigationEnd } from '@angular/router'

/* Based on https://nils-mehlhorn.de/posts/angular-navigate-back-previous-page */

@Injectable({ providedIn: 'root' })
export class LocationBackService {
	private readonly router = inject(Router)
	private readonly location = inject(Location)

	private history: string[] = []

	constructor() {
		this.router.events.subscribe((event) => {
			if (event instanceof NavigationEnd && !event.urlAfterRedirects.includes('login')) {
				this.history.push(event.urlAfterRedirects)
			}
		})
	}

	goBack(): void {
		this.history.pop()
		if (this.history.length > 0) {
			this.location.back()
		} else {
			this.router.navigateByUrl('/home')
		}
	}
}
