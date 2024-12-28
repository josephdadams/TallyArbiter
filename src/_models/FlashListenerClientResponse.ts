export interface FlashListenerClientResponse {
	result: 'flash-sent-successfully' | 'flash-not-sent'
	listenerClientId: string
	error?: 'listener-client-not-supported' | 'listener-client-not-found'
}
