import { Action } from '../actions/_Action'
import { DeviceAction } from '../_models/DeviceAction'

export type ActionType = new (action: DeviceAction) => Action
