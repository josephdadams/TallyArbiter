export interface DeviceSource {
	cloudClientId: any;
    address: string;
    deviceId: string;
    id: string;
    sourceId: string;
	bus: string;
	rename: boolean;
    
    // Volatile
    sourceIdx?: number;
}