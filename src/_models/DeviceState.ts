interface Source {
    address: string;
    sourceId: string;
}

export interface DeviceState {
    active: boolean;
    busId: string;
    deviceId: string;
    linkedSources: Source[];
    sources: Source[];
}