export interface DeviceSource {
    address: string;
    deviceId: string;
    id: string;
    sourceId: string;
    bus: string;
    
    // Volatile
    sourceIdx?: number;
}