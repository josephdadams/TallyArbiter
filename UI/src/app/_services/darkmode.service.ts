import { Injectable } from '@angular/core'

export type ThemePreference = 'light' | 'dark' | 'auto'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'darkMode'
const DEFAULT_PREFERENCE: ThemePreference = 'auto'

/**
 * Drives Bootstrap's native color modes by setting `data-bs-theme` on <html>.
 * The same attribute is set by an inline script in index.html before Angular
 * boots, so the first paint is already in the right theme.
 */
@Injectable({
	providedIn: 'root',
})
export class DarkModeService {
	private readonly prefersDark = window.matchMedia('(prefers-color-scheme: dark)')
	private preference: ThemePreference = DEFAULT_PREFERENCE

	public init() {
		this.preference = this.readPreference()
		this.prefersDark.addEventListener('change', () => {
			if (this.preference === 'auto') {
				this.apply()
			}
		})
		this.apply()
	}

	public getDarkMode(): ThemePreference {
		return this.preference
	}

	public setDarkMode(mode: ThemePreference) {
		this.preference = mode
		try {
			localStorage.setItem(STORAGE_KEY, mode)
		} catch {
			// Storage can be unavailable (private browsing, blocked site data).
			// The theme still applies for this page view.
		}
		this.apply()
	}

	/** The theme actually in effect, with 'auto' resolved against the OS setting. */
	public getResolvedTheme(): ResolvedTheme {
		if (this.preference === 'auto') {
			return this.prefersDark.matches ? 'dark' : 'light'
		}
		return this.preference
	}

	private readPreference(): ThemePreference {
		let stored: string | null = null
		try {
			stored = localStorage.getItem(STORAGE_KEY)
		} catch {
			// See setDarkMode().
		}
		return stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : DEFAULT_PREFERENCE
	}

	private apply() {
		const theme = this.getResolvedTheme()
		document.documentElement.setAttribute('data-bs-theme', theme)

		// Keep the browser/PWA chrome in step with the page.
		const meta = document.querySelector('meta[name="theme-color"]')
		meta?.setAttribute('content', theme === 'dark' ? '#212529' : '#1976d2')
	}
}
