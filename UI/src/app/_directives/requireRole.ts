import { Directive, Input, OnInit, TemplateRef, ViewContainerRef } from '@angular/core'
import { AuthService } from '../_services/auth.service'

@Directive({
	selector: '[requireRole]',
})
export class RequireRoleDirective implements OnInit {
	@Input() requireRole = ''

	constructor(
		private templateRef: TemplateRef<any>,
		private viewContainer: ViewContainerRef,
		private authService: AuthService,
	) {}

	ngOnInit() {
		if (this.authService.requireRole(this.requireRole)) {
			this.viewContainer.createEmbeddedView(this.templateRef)
		} else {
			this.viewContainer.clear()
		}
	}
}
