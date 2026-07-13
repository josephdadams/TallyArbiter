import path from 'path'

export function getAppDataFolder(): string {
	return path.join(
		process.env.APPDATA ||
			(process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share'),
		'TallyArbiter',
	)
}
