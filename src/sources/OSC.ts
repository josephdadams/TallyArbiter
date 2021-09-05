import { RegisterTallyInput } from "../_decorators/RegisterTallyInput.decorator";
import { Source } from '../_models/Source';
import { TallyInput } from './_Source';

@RegisterTallyInput("05d6bce1", "Open Sound Control (OSC)", "", [
    { fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
	{ fieldName: 'info', fieldLabel: 'Information', text: 'The device source address should be sent as an integer or a string to the server\'s IP address on the specified port. Sending to /tally/preview_on designates it as a Preview command, and /tally/program_on designates it as a Program command. Sending /tally/previewprogram_on and /tally/previewprogram_off will send both bus states at the same time. To turn off a preview or program, use preview_off and program_off. The first OSC argument received will be used for the device source address.', fieldType: 'info' }
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
