import axios from "axios";
import { logger } from "..";
import { RegisterAction } from "../_decorators/RegisterAction";
import { Action } from "./_Action";

@RegisterAction("4827f903", "RossTalk", [
    { fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
    { fieldName: 'string', fieldLabel: 'Command', fieldType: 'text' }
])
export class RossTalk extends Action {
    public run(): void {
        //
    }
}
