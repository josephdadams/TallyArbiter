export interface ConfigTSLClient {
	id: string
	ip: string
	port: number | string
	transport: string
	protocol?: string
	protocolOptions?: TSLClientProtocolOptions
}

export interface TSLClientProtocolOptions {
	brightness?: number
	
	tally1?: string
	tally2?: string
	tally3?: string
	tally4?: string

	text_tally?: string
	rh_tally?: string
	lh_tally?: string
	sequence?: string
}
