import { Directive, Input, OnInit, TemplateRef, ViewContainerRef, inject } from '@angular/core'
import { AuthService } from '../_services/auth.service'

@Directive({
	selector: '[requireRole]',
})
export class RequireRoleDirective implements OnInit {
	private templateRef = inject<TemplateRef<any>>(TemplateRef)
	private readonly viewContainer = inject(ViewContainerRef)
	private readonly authService = inject(AuthService)

	@Input() requireRole = ''

	ngOnInit() {
		if (this.authService.requireRole(this.requireRole)) {
			this.viewContainer.createEmbeddedView(this.templateRef)
		} else {
			this.viewContainer.clear()
		}
	}
}
