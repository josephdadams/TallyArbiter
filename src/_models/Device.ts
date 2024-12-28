export interface Device {
	linkedBusses: string[]
	cloudClientId: any
	name: string
	description: string
	enabled: boolean
	id: string
	tslAddress: string
	cloudConnection: boolean
	// volatile
	listenerCount?: number
	modePreview?: boolean
	modeProgram?: boolean
}
