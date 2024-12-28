import { BusOption } from './BusOption'
import { CloudDestination } from './CloudDestination'
import { Device } from './Device'
import { DeviceAction } from './DeviceAction'
import { DeviceSource } from './DeviceSource'
import { Source } from './Source'
import { TSLClient } from './TSLClient'
import { User } from './User'

export interface Manage {
	type:
		| 'source'
		| 'device'
		| 'device_source'
		| 'device_action'
		| 'tsl_client'
		| 'bus_option'
		| 'cloud_destination'
		| 'cloud_key'
		| 'cloud_client'
		| 'user'
	action: 'add' | 'edit' | 'delete' | 'remove'

	source?: Source
	sourceId?: string
	device?: Device
	deviceId?: string
	device_source?: DeviceSource
	device_action?: DeviceAction
	tslClient?: TSLClient
	tslClientId: string
	busOption?: BusOption
	busOptionId?: string
	cloudDestination?: CloudDestination
	cloudId?: string
	key?: string
	id?: string
	user?: User
}
