export interface DeviceAction {
	active: boolean
	busId: string
	data: Record<string, any>
	deviceId: string
	id: string
	outputTypeId: string
	// Volatile
	outputTypeIdx?: number
}
