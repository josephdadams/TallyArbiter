import { RegisterTallyInput } from "../_decorators/RegisterTallyInput.decorator";
import { Source } from '../_models/Source';
import { TallyInput } from './_Source';

@RegisterTallyInput("4a58f00f", "Roland Smart Tally", "", [{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' }])
export class EditMeSource extends TallyInput {
    private client: any;
    constructor(source: Source) {
        super(source);
        this.connected.next(true);
    }


    public exit(): void {
    }
}
