import EventEmitter from "events";
import { BehaviorSubject } from "rxjs";
import { logger } from "..";
import { Source } from "../_models/Source";
import { TallyData } from "../_types/TallyData";

const RECONNECT_INTERVAL = 5000; // in ms
const MAX_FAILED_RECONNECTS = 5;

export class TallyInput extends EventEmitter {
    public connected = new BehaviorSubject<boolean>(false);
    public tally = new BehaviorSubject<TallyData>({});
    public addresses = new BehaviorSubject<Address[]>([]);
    protected source: Source;
    private tryReconnecting = false;
    private reconnectFailureCounter = 0;
    reconnectTimeout: NodeJS.Timeout;

    constructor(source: Source) {
        super();
        this.source = source;
        logger(`Source: ${this.source.name} Creating connection.`, 'info-quiet');
        this.connected.subscribe((connected) => {
            if (connected) {
                this.tryReconnecting = true;
                this.reconnectFailureCounter = 0;
            } else {
                if (!this.tryReconnecting) {
                    // ignore the first one
                    this.tryReconnecting = true;
                    return;
                }
                console.log("not connected")
                if (this.tryReconnecting && this.reconnectFailureCounter < MAX_FAILED_RECONNECTS) {
                    if (this.reconnectTimeout) {
                        return;
                    }
                    console.log("try reconnecting", this.reconnectFailureCounter);
                    this.reconnectFailureCounter++;
                    this.reconnectTimeout = setTimeout(() => {
                        this.reconnectTimeout = undefined;
                        this.reconnect();
                    }, RECONNECT_INTERVAL);
                }
            }
        });
    }

    public exit(): void {
        this.tryReconnecting = false;
        logger(`Source: ${this.source.name}  Connection closed.`, 'info-quiet');
    }
    public reconnect(): void { }
    
    protected addAddress(label: string, address: string) {
        this.addresses.next(this.addresses.value.concat({ label, address }));
    }
    
    protected removeAddress(address: string) {
        this.addresses.next(this.addresses.value.filter((a) => a.address !== address));
    }
    
    protected renameAddress(address: string, newAddress: string, newLabel: string) {
        this.addresses.next(this.addresses.value.filter((a) => a.address !== address).concat({ address: newAddress, label: newLabel }));
    }

    protected addBusToAddress(address: string, bus: string) {
        const tally = this.tally.value;
        if (!Array.isArray(tally[address])) {
            tally[address] = [];
        }
        if (!tally[address].includes(bus)) {
            tally[address].push(bus);
        }
        this.tally.next(tally);
    }

    protected removeBusFromAddress(address: string, bus: string) {
        const tally = this.tally.value;
        if (!Array.isArray(tally[address])) {
            tally[address] = [];
        } else  {
            tally[address] = tally[address].filter((b) => b !== bus);
        }
        this.tally.next(tally);
    }

    protected removeBusFromAllAddresses(bus: string) {
        const tally = this.tally.value;
        for (const address of Object.keys(tally)) {
            tally[address] = tally[address].filter((b) => b !== bus);
        }
        this.tally.next(tally);
    }

    protected setBussesForAddress(address: string, busses: string[]) {
        const tally = this.tally.value;
        tally[address] = busses || [];
        this.tally.next(tally);
    }
}

export type Address = {
    label: string;
    address: string;
}