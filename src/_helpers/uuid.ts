import { v4 as uuid } from 'uuid'

export function uuidv4(): string {
	//unique UUID generator for IDs
	return uuid().split('-')[0]
}
