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
	cameraIP?: string
	cameraModel?: string
	//the camera's own tally lamp only, not Tally Arbiter's own idea of preview for this
	//device (UI, listener clients, device actions all still see preview normally)
	cameraPreviewDisabled?: boolean
}
