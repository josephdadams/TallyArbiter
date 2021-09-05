import { RegisterTallyInput } from "../_decorators/RegisterTallyInput.decorator";
import { Source } from '../_models/Source';
import { TallyInputConfigField } from "../_types/TallyInputConfigField";
import { TallyInput } from './_Source';

const TSLFields: TallyInputConfigField[] = [{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' }];

@RegisterTallyInput("5e0a1d8c", "TSL 3.1 UDP", "", TSLFields)
@RegisterTallyInput("dc75100e", "TSL 3.1 TCP", "", TSLFields)
@RegisterTallyInput("54237da7", "TSL 5.0 UDP", "", TSLFields)
@RegisterTallyInput("560d3065", "TSL 5.0 TCP", "", TSLFields)
export class EditMeSource extends TallyInput {
    private client: any;
    constructor(source: Source) {
        super(source);
        this.connected.next(true);
    }


    public exit(): void {
    }
}
