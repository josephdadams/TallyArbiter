// based on https://stackoverflow.com/a/122190
export function clone(obj) {
	if (obj === null || typeof obj !== 'object' || 'isActiveClone' in obj) return obj

	if (obj instanceof Date) var temp = new Date(obj) as any
	else var temp = obj.constructor() as any

	for (var key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			obj['isActiveClone'] = null
			temp[key] = clone(obj[key])
			delete obj['isActiveClone']
		}
	}
	return temp
}
