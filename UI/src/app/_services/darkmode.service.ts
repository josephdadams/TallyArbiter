import { Injectable } from '@angular/core'
import { enable as enableDarkMode, disable as disableDarkMode, auto as followSystemColorScheme } from 'darkreader'

@Injectable({
	providedIn: 'root',
})
export class DarkModeService {
	public darkModeTheme: object

	public getDarkMode(): string | null {
		return localStorage.getItem('darkMode')
	}

	public setDarkMode(mode: string) {
		localStorage.setItem('darkMode', mode)
		this.updatePageStyle()
	}

	public updatePageStyle() {
		switch (this.getDarkMode()) {
			case 'auto':
				followSystemColorScheme(this.darkModeTheme)
				break

			case 'light':
				disableDarkMode()
				break

			case 'dark':
				enableDarkMode(this.darkModeTheme)
				break
		}
	}

	public constructor() {
		this.darkModeTheme = {
			brightness: 100,
			contrast: 90,
			sepia: 0,
		}
	}

	public init() {
		if (!this.getDarkMode()) {
			this.setDarkMode('auto')
		} else {
			if (this.getDarkMode() === 'auto') {
				window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
					this.updatePageStyle()
				})
			}
			this.updatePageStyle()
		}
	}
}
