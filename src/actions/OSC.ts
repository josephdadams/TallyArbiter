import { logger } from "..";
import { RegisterAction } from "../_decorators/RegisterAction";
import { Action } from "./_Action";

@RegisterAction("58da987d", "OSC", [
    { fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
    { fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
    { fieldName: 'path', fieldLabel: 'Path', fieldType: 'text' },
    { fieldName: 'args', fieldLabel: 'Arguments', fieldType: 'text', help: 'Separate multiple argments with a space. Strings must be encapsulated by double quotes.'}
])
export class OSC extends Action {
    public run(): void {
        //
    }
}
