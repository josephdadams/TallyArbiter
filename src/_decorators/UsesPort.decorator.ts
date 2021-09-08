import 'reflect-metadata';
import { TallyInputType } from "../_types/TallyInputType";
import { PortsInUse } from "../_globals/PortsInUse";

export function UsesPort(port: string): (cls: TallyInputType) => void {
    return (cls: TallyInputType) => {
        PortsInUse.push({
            port,
            sourceId: Reflect.getMetadata("sourceId", cls) || "reserved",
        });
        return cls;
    };
}

export function UsePort(port: string, sourceId: string) {
    PortsInUse.push({
        port,
        sourceId,
    });
}

export function FreePort(port: string, sourceId: string) {
    PortsInUse.splice(PortsInUse.findIndex((p) => p.port == port && p.sourceId == sourceId), 1);
}