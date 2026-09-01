/**
 * Relative luminance per WCAG. Bus colours come from the user's config, so
 * anything drawing text on one has to work out for itself whether that text
 * should be black or white — the default preview green is unreadable under
 * white, and program red is unreadable under black.
 */
export function isLightColor(hex: string): boolean {
	const normalized = hex.replace('#', '')
	const full =
		normalized.length === 3
			? normalized
					.split('')
					.map((c) => c + c)
					.join('')
			: normalized
	if (full.length !== 6) return false

	const channels = [0, 2, 4].map((i) => {
		const value = parseInt(full.slice(i, i + 2), 16) / 255
		return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
	})
	const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
	return luminance > 0.35
}

/** Black or white, whichever is readable on `hex`. */
export function contrastColor(hex: string | undefined): string {
	return hex && isLightColor(hex) ? '#000000' : '#ffffff'
}
