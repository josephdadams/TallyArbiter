export interface Device {
    name: string;
    description: string;
    enabled: boolean;
    id: string;
    linkedPreview: boolean;
    linkedProgram: boolean;
    tslAddress: string;
    cloudConnection: boolean;
    // volatile
    listenerCount?: number;
    modePreview?: boolean;
    modeProgram?: boolean;
}