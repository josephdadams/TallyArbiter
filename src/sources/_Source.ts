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
                // Connected, no more reconnects for now
                console.log("status: connected", this.source.name);
                this.tryReconnecting = true;
                this.reconnectFailureCounter = 0;
            } else {
                if (!this.tryReconnecting) {
                    // Connection attempt at startup
                    console.log("Source:", this.source.name, "connect triggered at startup");
                    
                    if (this.source.unlimited_reconnects) {
                        console.log("Source:", this.source.name, "infinite reconnect attempts");
                    } else {
                        console.log("Source:", this.source.name, "max default reconnect attempts", MAX_FAILED_RECONNECTS);
                    }
                    this.tryReconnecting = true;
                    return;
                }

                // Reconnect if number of reconnects less than max number of reconnects or
                // if infinite reconnects are configured
                if ((this.tryReconnecting && this.reconnectFailureCounter < MAX_FAILED_RECONNECTS) ||
                    (this.tryReconnecting && this.source.unlimited_reconnects)) {
                    if (this.reconnectTimeout) {
                        console.log("Source:", this.source.name, "reconnect timeout not set")
                        return;
                    }

                    this.reconnectFailureCounter++;
                    console.log("Source:", this.source.name, "reconnect attempt:", this.reconnectFailureCounter);

                    // Use configured timeout only if larger then tally arbiter default
                    if (this.source.reconnect_intervall > RECONNECT_INTERVAL) {
                        console.log("Source:", this.source.name, "specific reconnect timeout", this.source.reconnect_intervall);
                        this.reconnectTimeout = setTimeout(() => {
                            this.reconnectTimeout = undefined;
                            this.reconnect();
                        }, this.source.reconnect_intervall);
                    } else {
                        console.log("Source:", this.source.name, "default reconnect timeout", RECONNECT_INTERVAL);
                        this.reconnectTimeout = setTimeout(() => {
                            console.log("Source:", this.source.name, "default timeout");
                            this.reconnectTimeout = undefined;
                            this.reconnect();
                        }, RECONNECT_INTERVAL);

                    }
                } else {
                    console.log("Source:", this.source.name, "no more reconnects");
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