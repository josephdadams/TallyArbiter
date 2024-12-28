import { SourceTypeBus } from '../_models/SourceTypeBus'
import { TallyInputConfigField } from '../_types/TallyInputConfigField'
import { TallyInputType } from '../_types/TallyInputType'

export const TallyInputs: Record<
	string,
	{
		cls: TallyInputType
		label: string
		help: string
		configFields: TallyInputConfigField[]
		busses: false | SourceTypeBus[]
	}
> = {}
