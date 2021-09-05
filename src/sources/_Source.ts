import EventEmitter from "events";
import { BehaviorSubject } from "rxjs";
import { Source } from "../../UI/src/app/_models/Source";

export class TallyInput extends EventEmitter {
    public connected = new BehaviorSubject<boolean>(false);
    public tally = new BehaviorSubject<any>(null);
    public addresses = new BehaviorSubject<Address[]>([]);
    protected source: Source;

    constructor(source: Source) {
        super();
        this.source = source;
    }

    public exit(): void {}
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
}

export type Address = {
    label: string;
    address: string;
}