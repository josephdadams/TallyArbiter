interface Source {
	address: string
	sourceId: string
}

export interface DeviceState {
	busId: string
	deviceId: string
	sources: string[]
}
