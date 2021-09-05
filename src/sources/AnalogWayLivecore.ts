import { RegisterTallyInput } from "../_decorators/RegisterTallyInput.decorator";
import { Source } from '../_models/Source';
import { TallyInput } from './_Source';

@RegisterTallyInput("a378e29d", "Analog Way Livecore", "Standard port is 10600. Source addresses are the input number.", [
    { fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
    { fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' }
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
