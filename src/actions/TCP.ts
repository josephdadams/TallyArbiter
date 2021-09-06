import { logger } from "..";
import { RegisterAction } from "../_decorators/RegisterAction";
import { Action } from "./_Action";

@RegisterAction("79e3ce27", "Generic TCP", [
    { fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
    { fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
    { fieldName: 'string', fieldLabel: 'TCP String', fieldType: 'text' },
    { fieldName: 'end', fieldLabel: 'End Character', fieldType: 'dropdown', options: [{ id: '', label: 'None' }, { id: '\n', label: 'LF - \\n' }, { id: '\r\n', label: 'CRLF - \\r\\n' }, { id: '\r', label: 'CR - \\r' }, { id: '\x00', label: 'NULL - \\x00' }]}
])
export class TCP extends Action {
    public run(): void {
        //
    }
}
