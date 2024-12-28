export interface TSLClient {
	connected: boolean
	ip: string
	id: string
	port: number | string
	transport: string
	socket?: any

	error?: boolean
}
