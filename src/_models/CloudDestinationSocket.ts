import { Socket } from 'socket.io-client';

export interface CloudDestinationSocket {
    id: string;
    socket: Socket;
    protocol: string;
    host: string;
    port: string;
    key: string;

    connected?: boolean;
    error?: boolean;
}