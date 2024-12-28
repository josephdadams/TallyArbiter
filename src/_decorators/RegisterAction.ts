import 'reflect-metadata'
import { Actions } from '../_globals/Actions'
import { ActionType } from '../_types/ActionType'
import { TallyInputConfigField } from '../_types/TallyInputConfigField'

export function RegisterAction(
	id: string,
	label: string,
	configFields: TallyInputConfigField[],
): (cls: ActionType) => void {
	return (cls) => {
		Reflect.defineMetadata('actionId', id, cls)
		Actions[id] = {
			cls,
			label,
			configFields,
		}
		return cls
	}
}
