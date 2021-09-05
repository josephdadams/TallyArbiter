import { RegisterTallyInput } from "../_decorators/RegisterTallyInput.decorator";
import { Source } from '../_models/Source';
import { TallyInput } from './_Source';

@RegisterTallyInput("627a5902", "Blackmagic VideoHub", "Uses Port 9990.", [
    { fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
    { fieldName: 'destinations_pvw', fieldLabel: 'Destinations to monitor as PVW', fieldType: 'text'},
    { fieldName: 'destinations_pgm', fieldLabel: 'Destinations to monitor as PGM', fieldType: 'text'}
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
