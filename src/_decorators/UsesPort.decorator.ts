import 'reflect-metadata'
import { TallyInputType } from '../_types/TallyInputType'
import { PortsInUse } from '../_globals/PortsInUse'
import { ListenerProviderType } from '../_types/ListenerProviderType'

export function UsesPort(port: number): (cls: TallyInputType | ListenerProviderType) => void {
	return (cls: TallyInputType | ListenerProviderType) => {
		PortsInUse.next(
			PortsInUse.value.concat({
				port,
				sourceId: Reflect.getMetadata('sourceId', cls) || 'reserved',
			}),
		)
		return cls
	}
}

export function UsePort(port: number, sourceId: 'reserved' | string) {
	PortsInUse.next(
		PortsInUse.value.concat({
			port,
			sourceId,
		}),
	)
}

export function FreePort(port: number, sourceId: string) {
	PortsInUse.value.splice(
		PortsInUse.value.findIndex((p) => p.port == port && p.sourceId == sourceId),
		1,
	)
	PortsInUse.next(PortsInUse.value)
}
