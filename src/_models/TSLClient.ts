import { TSLClientProtocolOptions } from './ConfigTSLClient'

export interface TSLClient {
	connected: boolean
	ip: string
	id: string
	port: number | string
	transport: string
	protocol?: string
	protocolOptions: TSLClientProtocolOptions
	socket?: any

	error?: boolean
}
