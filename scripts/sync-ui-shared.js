const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

const copies = [
	{
		from: 'src/_models',
		to: 'UI/src/app/_models',
	},
	{
		from: 'src/_types',
		to: 'UI/src/app/_types',
	},
	{
		from: 'src/_helpers/configSchema.ts',
		to: 'UI/src/app/_schemas/configSchema.ts',
	},
]

function copyRecursive(from, to) {
	const source = path.join(root, from)
	const destination = path.join(root, to)

	if (!fs.existsSync(source)) {
		console.warn(`Skipping missing source: ${source}`)
		return
	}

	fs.mkdirSync(path.dirname(destination), { recursive: true })

	const stat = fs.statSync(source)

	if (stat.isDirectory()) {
		fs.mkdirSync(destination, { recursive: true })

		for (const item of fs.readdirSync(source)) {
			copyRecursive(path.join(from, item), path.join(to, item))
		}
	} else {
		fs.mkdirSync(path.dirname(destination), { recursive: true })
		fs.copyFileSync(source, destination)
		console.log(`Copied ${from} -> ${to}`)
	}
}

for (const copy of copies) {
	copyRecursive(copy.from, copy.to)
}