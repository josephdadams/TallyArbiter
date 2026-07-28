export interface CameraModel {
	id: string
	label: string
	visible: boolean
}

export const CameraModels: CameraModel[] = [
	{ id: 'canon_xc', label: 'Canon PTZ Camera (XC Protocol)', visible: true },
	{
		id: 'sony_visca',
		label: 'Sony VISCA over IP - Single Tally Lamp (EXPERIMENTAL, untested on hardware)',
		visible: true,
	},
	{
		id: 'sony_visca_rg',
		label: 'Sony VISCA over IP - Red/Green Tally Lamps (EXPERIMENTAL, untested on hardware)',
		visible: true,
	},
	// Add more camera models as needed and support for them in
]
