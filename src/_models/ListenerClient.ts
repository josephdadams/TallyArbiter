import { Device } from './Device'

export interface ListenerClient {
	canBeFlashed: boolean
	canBeReassigned: boolean
	supportsChat?: boolean
	datetime_connected: number
	datetime_inactive?: number
	deviceId: string
	internalId: string
	id: string
	inactive: boolean
	ipAddress: string
	listenerType: string
	socketId: string
	cloudConnection?: boolean
	// volatile
	device?: Device
}
