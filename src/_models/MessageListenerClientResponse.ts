export interface MessageListenerClientResponse {
	result: 'message-sent-successfully' | 'message-not-sent'
	listenerClientId: string | { relayGroupId?: string; gpoGroupId?: string }
	error?: 'listener-client-not-supported' | 'listener-client-not-found'
}
