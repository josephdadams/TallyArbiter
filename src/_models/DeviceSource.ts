export interface DeviceSource {
    address: string;
    deviceId: string;
    id: string;
    sourceId: string;
	bus: string;
	rename: boolean;
    
    // Volatile
	cloudConnection?: any;
	cloudClientId?: any;
    sourceIdx?: number;
}