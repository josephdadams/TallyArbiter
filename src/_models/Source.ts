export interface Source {
	name: string
	connected: boolean
	enabled: boolean
	id: string
	reconnect: boolean
	sourceTypeId: string
	data: Record<string, any>
	reconnect_interval: number
	max_reconnects: number

	// Volatile
	cloudClientId?: any
	cloudConnection?: boolean
	sourceTypeName?: string
}
