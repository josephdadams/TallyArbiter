export interface CloudListenerSocketData {
	id: string
	socketId: string
	deviceId: string
	listenerType: string
	ipAddress: string
	datetimeConnected: string
	inactive: boolean

	cloudConnection?: boolean
	cloudClientId?: string
}
