import { RegisterTallyInput } from "../_decorators/RegisterTallyInput.decorator";
import { Source } from '../_models/Source';
import { TallyInput } from './_Source';

@RegisterTallyInput("TESTMODE", "Internal Test Mode", "Used for Test Mode functionality.", [
    { fieldName: 'info', fieldLabel: 'Information', text: 'This source generates preview/program tally data for the purposes of testing equipment. Please note that if you change the number of testing addresses or you update the interval you should restart TallyArbiter to apply these changes.', fieldType: 'info' },
    { fieldName: 'interval', fieldLabel: 'Bus change interval (in milliseconds (ms)) (default option: 1000).', fieldType: 'number' },
    { fieldName: 'changeMode', fieldLabel: 'Bus change mode (default option: one device at a time).', fieldType: 'dropdown', options: [
        { id: 'one-at-a-time', label: 'One device at a time' },
        { id: 'all-at-once', label: 'All devices at once' }
    ] },
    { fieldName: 'addressesNumber', fieldLabel: 'Test addresses number (default option: 10).', fieldType: 'number' }
])
export class InternalTestModeSource extends TallyInput {
    currentAddressNumber = 0;
    currentAddressIterations = 0;

    busses = ["preview", "program", "aux"];

    testModeInterval: NodeJS.Timeout;

    constructor(source: Source) {
        super(source);

        if(!this.source.data.interval) this.source.data.interval = 1000;
        if(!this.source.data.changeMode) this.source.data.changeMode = 'one-at-a-time';
        if(!this.source.data.addressesNumber) this.source.data.addressesNumber = 10;

        //console.log("addressesNumber", this.source.data.addressesNumber);

        for (let i = 1; i <= this.source.data.addressesNumber; i++) {
            this.addAddress("TEST_" + i, "TEST_" + i);
        }
        //Cut addresses list if there are more addresses than the number of addresses (for example if you change it to 5 and there are 10 addresses, removes the last 5 addresses)
        this.addresses.next(this.addresses.value.filter((a) => {
            let current_test_address_number = parseInt(a.address.replace("TEST_", ""));
            return current_test_address_number <= this.source.data.addressesNumber;
        }));
        this.sendTallyData();

        this.testModeInterval = setInterval(this.testModeIntervalFunction.bind(this), this.source.data.interval);
        
        this.connected.next(true);
    }

    private testModeIntervalFunction() {
        this.currentAddressIterations++;

        //console.log("currentAddressNumber", this.currentAddressNumber, "currentAddressIterations", this.currentAddressIterations, this.busses[this.currentAddressIterations - 1]);
        
        this.busses.forEach((busses) => {
            this.removeBusFromAllAddresses(busses);
        });

        if(this.source.data.changeMode == 'one-at-a-time'){
            this.setBussesForAddressFromIterationsNumber(this.currentAddressNumber);
        } else if(this.source.data.changeMode == 'all-at-once') {
            for (let i = 1; i <= this.source.data.addressesNumber; i++) {
                this.setBussesForAddressFromIterationsNumber(i);
            }
        }
        this.sendTallyData();

        if(this.currentAddressIterations >= this.busses.length) {
            if(this.source.data.changeMode == 'one-at-a-time') {
                if(this.currentAddressNumber < this.source.data.addressesNumber) {
                    this.currentAddressNumber++;
                } else {
                    this.currentAddressNumber = 1;
                }
            }
            this.currentAddressIterations = 0;
        }
    }

    private setBussesForAddressFromIterationsNumber(addressNumber: number) {
        if(this.currentAddressIterations <= this.busses.length) {
            this.setBussesForAddress("TEST_" + addressNumber, [this.busses[this.currentAddressIterations - 1]]);
        }
    }

    public exit(): void {
        super.exit();
        clearInterval(this.testModeInterval);
    }
}
