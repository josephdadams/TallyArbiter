export type TallyInputConfigField = {
	fieldName: string
	fieldLabel: string
	fieldType: 'text' | 'port' | 'number' | 'bool' | 'dropdown' | 'multiselect' | 'info'
	help?: string
	optional?: boolean
	// Only meaningful when fieldType is 'dropdown' or 'multiselect'.
	options?: {
		id: string
		label: string
	}[]
	// Only meaningful when fieldType is 'info'.
	text?: string
}
