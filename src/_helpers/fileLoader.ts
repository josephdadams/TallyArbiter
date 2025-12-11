import fs from 'fs'
import path from 'path'

export function loadClassesFromFolder(folder: string): void {
	const dirPath = path.join(__dirname, '../', folder)

	for (const file of fs.readdirSync(dirPath)) {
		// Skip hidden files, non-JS/TS files, and folders
		if (
			file.startsWith('.') || // ignore .DS_Store, etc.
			!file.match(/\.(js|ts)$/) || // ignore non-code files
			fs.statSync(path.join(dirPath, file)).isDirectory() // skip folders
		) {
			continue
		}

		require(path.join(dirPath, file.replace(/\.(ts|js)$/, '')))
	}
}
