export interface LogItem {
	datetime: string
	log: string
	type: 'info' | 'info-quiet' | 'error' | 'console_action'
}
