export interface CloudListenerSocketData {
    id: string;
    socketId: string;
    deviceId: string;
    listenerType: string;
    ipAddress: string;
    datetime_connected: number;
    datetime_inactive?: number;
    inactive: boolean;

    cloudConnection?: boolean;
    cloudClientId?: string;

    canBeFlashed: boolean;
    canBeReassigned: boolean;
    supportsChat: boolean;
    internalId: string;
}