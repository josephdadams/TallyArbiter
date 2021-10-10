export function uuidv4(): string //unique UUID generator for IDs
{
	return 'xxxxxxxx'.replace(/[xy]/g, (c) => {
		let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}