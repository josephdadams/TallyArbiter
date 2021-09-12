import 'reflect-metadata';
import { TallyInputType } from "../_types/TallyInputType";
import { PortsInUse } from "../_globals/PortsInUse";
import { ListenerProviderType } from '../_types/ListenerProviderType';

export function UsesPort(port: string): (cls: TallyInputType | ListenerProviderType) => void {
    return (cls: TallyInputType | ListenerProviderType) => {
        PortsInUse.next(PortsInUse.value.concat({
            port,
            sourceId: Reflect.getMetadata("sourceId", cls) || "reserved",
        }));
        return cls;
    };
}

export function UsePort(port: string, sourceId: "reserved" | string) {
    PortsInUse.next(PortsInUse.value.concat({
        port,
        sourceId,
    }));
}

export function FreePort(port: string, sourceId: string) {
    //PortsInUse.next(PortsInUse.value.splice(PortsInUse.value.findIndex((p) => p.port == port && p.sourceId == sourceId), 1));
    PortsInUse.value.splice(PortsInUse.value.findIndex((p) => p.port == port && p.sourceId == sourceId), 1);
}