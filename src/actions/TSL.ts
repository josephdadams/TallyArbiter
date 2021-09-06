import { logger } from "..";
import { RegisterAction } from "../_decorators/RegisterAction";
import { TallyInputConfigField } from "../_types/TallyInputConfigField";
import { Action } from "./_Action";


const TSLFields: TallyInputConfigField[] = [ //TSL 3.1 UDP
    { fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
    { fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
    { fieldName: 'address', fieldLabel: 'Address', fieldType: 'number' },
    { fieldName: 'label', fieldLabel: 'Label', fieldType: 'text' },
    { fieldName: 'tally1', fieldLabel: 'Tally 1 (PVW)', fieldType: 'bool' },
    { fieldName: 'tally2', fieldLabel: 'Tally 2 (PGM)', fieldType: 'bool' },
    { fieldName: 'tally3', fieldLabel: 'Tally 3', fieldType: 'bool' },
    { fieldName: 'tally4', fieldLabel: 'Tally 4', fieldType: 'bool' }
]


@RegisterAction("7dcd66b5", "TSL 3.1 UDP", TSLFields)
@RegisterAction("276a8dcc", "TSL 3.1 TCP", TSLFields)
export class TSL extends Action {
    public run(): void {
        //
    }
}
