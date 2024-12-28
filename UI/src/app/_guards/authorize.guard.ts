import { Injectable } from '@angular/core'
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router'
import { Observable } from 'rxjs'
import { AuthService } from '../_services/auth.service'

@Injectable({
	providedIn: 'root',
})
export class AuthorizeGuard {
	constructor(
		private authService: AuthService,
		private router: Router,
	) {}

	canActivate(
		route: ActivatedRouteSnapshot,
		state: RouterStateSnapshot,
	): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
		let destination = ['login'].concat(
			state.url
				.replace('/', '')
				.split('/')
				.map((x) => x.replace('/', '')),
		)
		let currentSection = destination[1]
		let requiredRole = ''
		switch (currentSection) {
			case 'errors':
				requiredRole = 'admin'
				break

			case 'settings':
				requiredRole = 'settings'
				break

			case 'producer':
				requiredRole = 'producer'
				break
		}
		if (this.authService.profile === undefined) {
			console.log('Not logged in. Navigating to the login page...')
			this.router.navigate(destination)
			return false
		} else {
			let checkRole = this.authService.requireRole(requiredRole)
			if (checkRole) {
				return true
			} else {
				console.log('Access denied. Navigating to the login page...')
				this.router.navigate(destination)
				return false
			}
		}
	}
}
