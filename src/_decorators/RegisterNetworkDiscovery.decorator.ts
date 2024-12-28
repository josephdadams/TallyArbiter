import 'reflect-metadata'
import { TallyInputType } from '../_types/TallyInputType'
import { RegisteredNetworkDiscoveryServices } from '../_globals/RegisteredNetworkDiscoveryServices'
import { ListenerProviderType } from '../_types/ListenerProviderType'
import { NetworkDiscovery } from '../_models/NetworkDiscovery'
import { logger } from '..'

interface DeviceData {
	name: string
	addresses: string[]
}

function addDiscoveredDevice(service: NetworkDiscovery, cls: TallyInputType | ListenerProviderType) {
	let sourceId = Reflect.getMetadata('sourceId', cls)
	service.sourceId = sourceId
	logger(`Device discovered on the network: ${service.name} (${service.addresses.join(' / ')})`)
	RegisteredNetworkDiscoveryServices.next(RegisteredNetworkDiscoveryServices.value.concat(service))
}

export function RegisterNetworkDiscovery(
	callback: (addDiscoveredDevice: (deviceData: DeviceData) => void) => void,
): (cls: TallyInputType | ListenerProviderType) => void {
	return (cls: TallyInputType | ListenerProviderType) => {
		callback((service: NetworkDiscovery) => {
			addDiscoveredDevice(service, cls)
		})
		return cls
	}
}
