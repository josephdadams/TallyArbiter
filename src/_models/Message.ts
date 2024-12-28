export interface Message {
	type: 'producer' | 'client' | 'server'
	socketId: string
	text: string
	date: Date
}
