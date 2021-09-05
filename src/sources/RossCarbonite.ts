import { RegisterTallyInput } from "../_decorators/RegisterTallyInput.decorator";
import { Source } from '../_models/Source';
import { TallyInputConfigField } from "../_types/TallyInputConfigField";
import { TallyInput } from './_Source';

const RossCarboniteFields: TallyInputConfigField[] = [
    { fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
    {
        fieldName: 'transport_type', fieldLabel: 'Transport Type', fieldType: 'dropdown',
        options: [
            { id: 'udp', label: 'UDP' },
            { id: 'tcp', label: 'TCP' }
        ]
    },
];

@RegisterTallyInput("039bb9d6", "Ross Carbonite", "", RossCarboniteFields)
@RegisterTallyInput("e1c46de9", "Ross Carbonite Black Solo", "", RossCarboniteFields)
@RegisterTallyInput("63d7ebc6", "Ross Graphite", "", RossCarboniteFields)
@RegisterTallyInput("22d507ab", "Ross Carbonite Black SD/HD", "", RossCarboniteFields)
@RegisterTallyInput("7da3b524", "Ross Carbonite Ultra", "", RossCarboniteFields)
export class EditMeSource extends TallyInput {
    private client: any;
    constructor(source: Source) {
        super(source);
        this.connected.next(true);
    }


    public exit(): void {
    }
}
