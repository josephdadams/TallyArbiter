import { Component, Input } from '@angular/core'
import { DarkModeService } from '../../_services/darkmode.service'

@Component({
	selector: 'app-theme-selector',
	templateUrl: './theme-selector.component.html',
	styleUrls: ['./theme-selector.component.scss'],
})
export class ThemeSelectorComponent {
	@Input() selector_style: string = 'icon'

	constructor(public darkModeService: DarkModeService) {}
}
