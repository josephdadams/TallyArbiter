export interface FlashListenerClientResponse {
    result: 'flash-sent-successfully' | 'flash-not-sent';
    listenerClientId: string;
    error?: string;
}