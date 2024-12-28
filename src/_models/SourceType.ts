import { SourceTypeBus } from './SourceTypeBus'

export interface SourceType {
	enabled: boolean
	help: string
	id: string
	label: string
	type: string
	busses: SourceTypeBus[]
}
