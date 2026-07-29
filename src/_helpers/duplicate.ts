import { Device } from '../_models/Device'
import { DeviceAction } from '../_models/DeviceAction'
import { DeviceSource } from '../_models/DeviceSource'
import { clone } from './clone'
import { uuidv4 } from './uuid'

export interface DuplicatedDevice {
	device: Device
	device_sources: DeviceSource[]
	device_actions: DeviceAction[]
}

// "Camera 1" -> "Camera 1 (copy)" -> "Camera 1 (copy 2)" -> ...
// An existing copy suffix is stripped first, so duplicating a duplicate gives "Camera 1 (copy 2)"
// rather than "Camera 1 (copy) (copy)". Names are not a key anywhere (ids are), but a list of six
// identically named devices is exactly the thing this feature is supposed to save the user from.
export function generateDuplicateName(name: string, existingNames: string[]): string {
	const base = (name || '').replace(/\s*\(copy(?:\s+\d+)?\)\s*$/i, '').trim() || 'Untitled'

	let candidate = `${base} (copy)`
	let counter = 2

	while (existingNames.includes(candidate)) {
		candidate = `${base} (copy ${counter})`
		counter++
	}

	return candidate
}

// Every field is listed explicitly rather than spread, for two reasons: volatile fields
// (outputTypeIdx here, listenerCount/modePreview/modeProgram/cloudClientId on Device) describe the
// original's live state and must not ride along, and `data` is an arbitrary nested object that has
// to be deep copied. Spreading would alias it, so editing the copy's action data would silently
// rewrite the original's.
export function buildDuplicateDeviceAction(sourceAction: DeviceAction, deviceId: string): DeviceAction {
	return {
		id: uuidv4(),
		deviceId: deviceId,
		busId: sourceAction.busId,
		active: sourceAction.active,
		outputTypeId: sourceAction.outputTypeId,
		data: clone(sourceAction.data ?? {}),
	}
}

export function buildDuplicateDeviceSource(sourceDeviceSource: DeviceSource, deviceId: string): DeviceSource {
	return {
		id: uuidv4(),
		deviceId: deviceId,
		sourceId: sourceDeviceSource.sourceId,
		address: sourceDeviceSource.address,
		bus: sourceDeviceSource.bus,
		rename: sourceDeviceSource.rename,
		reconnect_interval: sourceDeviceSource.reconnect_interval,
		max_reconnects: sourceDeviceSource.max_reconnects,
	}
}

// Builds the whole cascade a device duplicate implies - the device plus its device sources and
// device actions - as the mirror image of the cascade TallyArbiter_Delete_Device tears down.
// Returns new objects only; the caller is responsible for committing them to the live arrays.
export function buildDuplicateDevice(
	sourceDevice: Device,
	allDeviceSources: DeviceSource[],
	allDeviceActions: DeviceAction[],
	existingDeviceNames: string[],
): DuplicatedDevice {
	const device: Device = {
		id: uuidv4(),
		name: generateDuplicateName(sourceDevice.name, existingDeviceNames),
		description: sourceDevice.description,
		// A TSL address identifies the device to every connected TSL client. Two devices sharing one
		// address would both drive the same physical display, with whichever updated last winning, so
		// the copy starts with no address and the user assigns a free one when they edit it.
		tslAddress: '',
		// The copy points at the original's sources until the user re-points it. Leaving it enabled
		// would mean creating it immediately fires a second set of actions off the original camera's
		// tally - real relays and lights, on a live system. It is created disabled and the user
		// enables it once it is configured.
		enabled: false,
		// new array: sharing the reference would make editing either device's linked busses edit both
		linkedBusses: [...(sourceDevice.linkedBusses || [])],
		cameraIP: sourceDevice.cameraIP,
		cameraModel: sourceDevice.cameraModel,
		// cloud ownership and the volatile live-state fields (listenerCount, modePreview, modeProgram)
		// describe the original and are deliberately not carried over
		cloudConnection: false,
		cloudClientId: undefined,
	}

	const device_sources = allDeviceSources
		.filter((deviceSource) => deviceSource.deviceId === sourceDevice.id)
		.map((deviceSource) => buildDuplicateDeviceSource(deviceSource, device.id))

	const device_actions = allDeviceActions
		.filter((deviceAction) => deviceAction.deviceId === sourceDevice.id)
		.map((deviceAction) => buildDuplicateDeviceAction(deviceAction, device.id))

	return { device, device_sources, device_actions }
}
