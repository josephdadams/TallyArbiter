export interface TSLClient {
    connected: boolean;
    ip: string;
    id: string;
    port: number;
    transport: string;
    socket?: any;
}