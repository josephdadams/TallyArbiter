import 'reflect-metadata'
import { TallyInputs } from '../_globals/TallyInputs'
import { SourceTypeBus } from '../_models/SourceTypeBus'
import { TallyInputConfigField } from '../_types/TallyInputConfigField'
import { TallyInputType } from '../_types/TallyInputType'

export function RegisterTallyInput(
	id: string,
	label: string,
	help: string,
	configFields: TallyInputConfigField[],
	busses: SourceTypeBus[] | false = false,
): (cls: TallyInputType) => void {
	return (cls) => {
		Reflect.defineMetadata('sourceId', id, cls)
		TallyInputs[id] = {
			cls,
			label,
			help,
			configFields,
			busses,
		}
		return cls
	}
}
