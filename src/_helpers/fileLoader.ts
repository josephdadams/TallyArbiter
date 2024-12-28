import fs from 'fs'
import path from 'path'

export function loadClassesFromFolder(folder: string): void {
	for (const file of fs.readdirSync(path.join(__dirname, '../', folder)).filter((f) => !f.startsWith('_'))) {
		require(path.join(__dirname, '../', folder, file.replace('.ts', '')))
	}
}
