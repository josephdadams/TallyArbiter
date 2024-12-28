export interface CloudDestination {
	connected: boolean
	host: string
	id: string
	key: string
	port: string
	status: 'connected' | 'disconnected' | 'invalid_key' | 'error'

	error?: boolean
}
