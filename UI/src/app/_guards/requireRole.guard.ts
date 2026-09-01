import { inject } from '@angular/core'
import { CanActivateFn, Router } from '@angular/router'
import { AuthService } from '../_services/auth.service'

/**
 * Gates a settings tab on its specific sub-role. AuthorizeGuard only checks that
 * the user holds *some* settings role and can reach the shell; without this a
 * user with, say, only `settings:logs` could deep-link to the config editor.
 */
export function requireRoleGuard(role: string): CanActivateFn {
	return () => {
		const authService = inject(AuthService)
		const router = inject(Router)

		if (authService.requireRole(role)) {
			return true
		}
		return router.createUrlTree(['/home'])
	}
}
