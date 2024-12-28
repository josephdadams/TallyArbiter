import { TallyInput } from '../sources/_Source'
import { Source } from '../_models/Source'

export type TallyInputType = new (source: Source) => TallyInput
