export function clone<T>(obj: T): T {
	return structuredClone(obj)
}
