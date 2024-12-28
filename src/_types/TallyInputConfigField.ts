export type TallyInputConfigField = {
	fieldName: string
	fieldLabel: string
	help?: string
	optional?: boolean
} & (
	| {
			fieldType: 'text' | 'port' | 'number' | 'bool'
	  }
	| {
			fieldType: 'dropdown' | 'multiselect'
			options: {
				id: string
				label: string
			}[]
	  }
	| {
			fieldType: 'info'
			text: string
	  }
)
