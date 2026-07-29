import { BusOption } from './BusOption'
import { CloudDestination } from './CloudDestination'
import { ConfigSecuritySection } from './ConfigSecuritySection'
import { User } from './User'
import { ConfigTSLClient } from './ConfigTSLClient'
import { Device } from './Device'
import { DeviceAction } from './DeviceAction'
import { DeviceSource } from './DeviceSource'
import { Source } from './Source'
import { ConfigMQTT } from '../_modules/MQTT'

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
	//server-wide chat on/off switch. absent in configs written before this option
	//existed, which must keep behaving as "on", so treat only an explicit `false`
	//as disabled (see isChatEnabled in _helpers/chat.ts)
	chat_enabled?: boolean
	remoteErrorReporting: boolean
	mqtt?: ConfigMQTT
}
