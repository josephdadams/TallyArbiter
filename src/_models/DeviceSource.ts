export interface DeviceSource {
	address: string
	deviceId: string
	id: string
	sourceId: string
	bus: string
	rename: boolean
	reconnect_interval: number
	max_reconnects: number

	// Volatile
	cloudConnection?: any
	cloudClientId?: any
	sourceIdx?: number
}
