import net from "net";
import { version } from "os";
import { EventEmitter } from "stream";
import { logger } from "..";
import { UsesPort } from "../_decorators/UsesPort.decorator";
import { uuidv4 } from "../_helpers/uuid";

export class ListenerProvider extends EventEmitter {
    
}

@UsesPort("8099")
export class VMixEmulator extends ListenerProvider {
    private server: net.Server;
    private readonly port: string = '8099';
    public vmix_clients = []; // Clients currently connected to the VMix Emulator
    public vmix_client_data = []; // array of connected Vmix clients

    public startVMixEmulator() {
        this.server = net.createServer();

        this.server.on('connection', (socket) => this.handleConnection(socket));

        this.server.listen(parseInt(this.port), () => {
            logger(`Finished VMix Emulation Setup. Listening for VMix Tally Connections on TCP Port ` + this.port + `.`, 'info-quiet');
        });
        this.deleteInactiveListenerClients();
    }

    private handleConnection(socket: net.Socket) {
        let host = this.getHost(socket);
        logger(`New VMix Emulator Connection from ${host}`, 'info');
        socket.write(`VERSION OK ${version}\r\n`);
        socket.on('data', (data) => this.onConnData(socket, data));
        socket.once('close', () => this.onConnClose(socket));
        socket.on('error', (e) => this.onConnError(socket, e));


    }

    private getHost(socket: net.Socket) {
        return socket.remoteAddress + ':' + socket.remotePort;
    }

    private onConnData(socket: net.Socket, d: Buffer) {
        const parts = d.toString().split(/\r?\n/);

        if (parts[0] === 'SUBSCRIBE TALLY') {
            this.addVmixListener(socket, this.getHost(socket));
            socket.write('SUBSCRIBE OK TALLY\r\n');
        }
        else if (parts[0] === 'UNSUBSCRIBE TALLY') {
            socket.write('UNSUBSCRIBE OK TALLY\r\n');
            this.removeVmixListener(this.getHost(socket));
        }
        else if (parts[0] === 'QUIT') {
            socket.destroy();
        }
    }
    private onConnClose(socket: net.Socket) {
        const host = this.getHost(socket);
        this.removeVmixListener(host);
        logger(`VMix Emulator Connection from ${host} closed`, 'info');
    }
    private onConnError(socket: net.Socket, err) {
        const host = this.getHost(socket);
        if (err.message === 'This socket has been ended by the other party') {
            logger(`VMix Emulator Connection ${host} taking longer to respond than normal`, 'info-quiet');
            //removeVmixListener(host);
        } else {
            logger(`VMix Emulator Connection ${host} error: ${err.message}`, 'error');
        }
    }

    private addVmixListener(conn, host) {
        let socketId = 'vmix-' + uuidv4();
        //listenerClientId = AddListenerClient(socketId, null, 'vmix', host, new Date().getTime(), false, false);
        conn.listenerClientId = uuidv4();
        conn.host = host;
        conn.socketId = socketId;
        this.vmix_clients.push(conn);

        //Push to global var
        this.vmix_client_data.push({
            host,
            socketID: socketId,
            inactive: false,
        });
        console.log(this.vmix_client_data);
        console.log(this.vmix_client_data.length);
        this.emit("updateClients");
        logger(`VMix Emulator Connection ${host} subscribed to tally`, 'info');
    }

    private removeVmixListener(host) {
        let socketId = null;

        for (let i = 0; i < this.vmix_client_data.length; i++) {
            if (this.vmix_client_data[i].host === host) {
                socketId = this.vmix_client_data[i].socketId;
                this.vmix_client_data.splice(i, 1);
            }
        }

        if (socketId !== null) {
            this.deactivateListenerClient(socketId);
        }

        logger(`VMix Emulator Connection ${host} unsubscribed to tally`, 'info');
    }



    private deactivateListenerClient(socketId) {
        for (let i = 0; i < this.vmix_client_data.length; i++) {
            if (this.vmix_client_data[i].socketId === socketId) {
                this.vmix_client_data[i].inactive = true;
                this.vmix_client_data[i].datetime_inactive = new Date().getTime();
                let message = `Listener Client Disconnected: ${this.vmix_client_data[i].host.replace('::ffff:', '')} at ${new Date()}`;
                this.emit("chatMessage", 'server', null, message)
            }
        }

        console.log(this.vmix_client_data);
        this.emit("updateClients");
    }

    private deleteInactiveListenerClients() {
        let changesMade = false;
        for (let i = this.vmix_client_data.length - 1; i >= 0; i--) {
            if (this.vmix_client_data[i].inactive === true) {
                let dtNow = new Date().getTime();
                if ((dtNow - this.vmix_client_data[i].datetime_inactive) > (1000 * 60 * 60)) { //1 hour
                    logger(`Inactive Client removed: ${this.vmix_client_data[i].id}`, 'info');
                    this.vmix_client_data.splice(i, 1);
                    changesMade = true;
                }
            }
        }
    
        if (changesMade) {
            this.emit("updateClients");
        }
    
        setTimeout(() => this.deleteInactiveListenerClients(), 5 * 60 * 1000); // runs every 5 minutes
    }
}