export interface DeviceAction {
    active: true
    busId: string;
    data: Record<string, any>;
    deviceId: string;
    id: string;
    outputTypeId: string;
    // Volatile
    outputTypeIdx?: number;
}