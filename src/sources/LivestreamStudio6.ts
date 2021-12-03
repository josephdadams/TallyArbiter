import { logger } from "..";
import { RegisterTallyInput } from "../_decorators/RegisterTallyInput.decorator";
import { Source } from '../_models/Source';
import { TallyInput } from './_Source';
import net from "net";

@RegisterTallyInput("934b5102", "Livestream Studio6", "", [
    { fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
])
export class LivestreamStudio6Source extends TallyInput {
    constructor(source: Source) {
        super(source);
        this.connected.next(true);
    }

    public exit(): void {
        super.exit();
    }
}
