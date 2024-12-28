import { DeviceAction } from '../_models/DeviceAction'

export class Action {
	protected action: DeviceAction

	constructor(action: DeviceAction) {
		this.action = action
	}

	public run(): void {}
}
