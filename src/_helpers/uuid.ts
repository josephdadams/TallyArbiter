import { uuid } from 'uuidv4';

export function uuidv4(): string //unique UUID generator for IDs
{
	return uuid().split("-")[0];
}