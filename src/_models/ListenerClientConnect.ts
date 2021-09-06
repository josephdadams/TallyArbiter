export interface ListenerClientConnect {
    deviceId: string;
    listenerType: string;

    canBeReassigned?: boolean;
    canBeFlashed?: boolean;
    supportsChat?: boolean;
    reassign?: boolean;
    flash?: boolean;
    chat?: boolean;
}