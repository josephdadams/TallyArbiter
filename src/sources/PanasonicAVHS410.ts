import { RegisterTallyInput } from "../_decorators/RegisterTallyInput.decorator";
import { Source } from '../_models/Source';
import { TallyInput } from './_Source';

@RegisterTallyInput("7da3b526", "Panasonic AV-HS410", "Uses port 60020. Make sure to have Multicast enabled on the network", [
    { fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
])
export class EditMeSource extends TallyInput {
    private client: any;
    constructor(source: Source) {
        super(source);
        this.connected.next(true);
    }


    public exit(): void {
    }
}
