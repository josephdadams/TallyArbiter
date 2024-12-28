import { BusOption } from './BusOption'
import { CloudDestination } from './CloudDestination'
import { ConfigSecuritySection } from './ConfigSecuritySection'
import { User } from './User'
import { ConfigTSLClient } from './ConfigTSLClient'
import { Device } from './Device'
import { DeviceAction } from './DeviceAction'
import { DeviceSource } from './DeviceSource'
import { Source } from './Source'

export interface Config {
	externalAddress: string
	uuid: string
	security: ConfigSecuritySection
	users: User[]
	sources: Source[]
	devices: Device[]
	device_sources: DeviceSource[]
	device_actions: DeviceAction[]
	tsl_clients: ConfigTSLClient[]
	tsl_clients_1secupdate: boolean
	cloud_destinations: CloudDestination[]
	cloud_keys: string[]
	bus_options: BusOption[]
	remoteErrorReporting: boolean
}
