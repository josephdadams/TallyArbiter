import { RegisterTallyInput } from "../_decorators/RegisterTallyInput.decorator";
import { Source } from '../_models/Source';
import { TallyInput } from './_Source';

@RegisterTallyInput("TESTMODE", "Internal Test Mode", "Used for Test Mode functionality.", [{ fieldName: 'info', fieldLabel: 'Information', text: 'This source generates preview/program tally data for the purposes of testing equipment.', fieldType: 'info' }])
export class InternalTestModeSource extends TallyInput {
    private client: any;
    constructor(source: Source) {
        super(source);
        this.connected.next(true);
    }


    public exit(): void {
        super.exit();
    }
}
