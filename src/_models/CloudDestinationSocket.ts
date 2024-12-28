import { Socket } from 'socket.io-client'

export interface CloudDestinationSocket {
	id: string
	socket: Socket
	host: string
	port: string
	key: string

	connected?: boolean
	error?: boolean
}
