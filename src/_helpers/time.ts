//based on https://stackoverflow.com/a/37096512
//used in login function for displaying rate limits
export function secondsToHms(d: number | string): string {
	d = Number(d)
	var h = Math.floor(d / 3600)
	var m = Math.floor((d % 3600) / 60)
	var s = Math.floor((d % 3600) % 60)

	var hDisplay = h > 0 ? h + (h == 1 ? ' hour, ' : ' hours, ') : ''
	var mDisplay = m > 0 ? m + (m == 1 ? ' minute, ' : ' minutes, ') : ''
	var sDisplay = s > 0 ? s + (s == 1 ? ' second' : ' seconds') : ''
	let hmsString = hDisplay + mDisplay + sDisplay
	if (hmsString.endsWith(', ')) hmsString = hmsString.slice(0, -2)
	return hmsString
}
