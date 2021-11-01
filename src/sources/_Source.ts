import { EventEmitter } from "events";
import { BehaviorSubject } from "rxjs";
import { logger } from "..";
import { Address } from "../_models/Address";
import { Source } from "../_models/Source";
import { AddressTallyData } from "../_models/TallyData";

const RECONNECT_INTERVAL = 5000; // in ms
const MAX_FAILED_RECONNECTS = 5;

export class TallyInput extends EventEmitter {
    public connected = new BehaviorSubject<boolean>(false);
    public tally = new BehaviorSubject<AddressTallyData>({});
    private tallyData = {};
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
                //console.log("not connected")
                if (this.tryReconnecting && this.reconnectFailureCounter < MAX_FAILED_RECONNECTS) {
                    if (this.reconnectTimeout) {
                        return;
                    }
                    //console.log("try reconnecting", this.reconnectFailureCounter);
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
    }
    public reconnect(): void { }
    
    protected addAddress(label: string, address: string) {
        this.addresses.next(this.addresses.value.concat({ label, address }));
    }
    
    protected removeAddress(address: string) {
        this.addresses.next(this.addresses.value.filter((a) => a.address !== address));
    }
    
    protected renameAddress(address: string, newAddress: string, newLabel: string) {
        this.emit("renameAddress", address, newAddress);
        this.addresses.next(this.addresses.value.filter((a) => a.address !== address).concat({ address: newAddress, label: newLabel }));
    }

    protected addBusToAddress(address: string, bus: string) {
        if (!Array.isArray(this.tallyData[address])) {
            this.tallyData[address] = [];
        }
        if (!this.tallyData[address].includes(bus)) {
            this.tallyData[address].push(bus);
        }
    }

    protected removeBusFromAddress(address: string, bus: string) {
        if (!Array.isArray(this.tallyData[address])) {
            this.tallyData[address] = [];
        } else  {
            this.tallyData[address] = this.tallyData[address].filter((b) => b !== bus);
        }
    }

    protected removeBusFromAllAddresses(bus: string) {
        for (const address of Object.keys(this.tallyData)) {
            this.tallyData[address] = this.tallyData[address].filter((b) => b !== bus);
        }
    }

    protected setBussesForAddress(address: string, busses: string[]) {
        this.tallyData[address] = busses || [];
    }

    protected clearTallies() {
        for(let i = 0; i < this.addresses.value.length; i++) {
            let currentAddress = this.addresses.value[i].address;
            this.setBussesForAddress(currentAddress, []);
            this.sendTallyData();
        }
    }

    protected sendTallyData() {
        this.tally.next(this.tallyData);
    }
}