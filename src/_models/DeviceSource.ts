export interface DeviceSource {
    address: string;
    deviceId: string;
    id: string;
    sourceId: string;
	bus: string;
    rename: boolean;
    reconnect_intervall: number;
    max_reconnects: number;
    
    // Volatile
	cloudConnection?: any;
	cloudClientId?: any;
    sourceIdx?: number;
}