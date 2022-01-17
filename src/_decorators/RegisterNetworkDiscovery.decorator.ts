import 'reflect-metadata';
import { TallyInputType } from "../_types/TallyInputType";
import { RegisteredNetworkDiscoveryServices } from "../_globals/RegisteredNetworkDiscoveryServices";
import { ListenerProviderType } from '../_types/ListenerProviderType';
import { NetworkDiscovery } from '../_models/NetworkDiscovery';

RegisteredNetworkDiscoveryServices.subscribe((el) => console.log(el));

function addDiscoveredDevice(service: NetworkDiscovery, cls: TallyInputType | ListenerProviderType) {
    let sourceId = Reflect.getMetadata("sourceId", cls);
    console.log("registered net discovery", service, sourceId, cls);
    service.sourceId = sourceId;
    RegisteredNetworkDiscoveryServices.next(RegisteredNetworkDiscoveryServices.value.concat(service));
}

export function RegisterNetworkDiscovery(callback: (addDiscoveredDevice) => void): (cls: TallyInputType | ListenerProviderType) => void {
    return (cls: TallyInputType | ListenerProviderType) => {
        callback((service: NetworkDiscovery) => { addDiscoveredDevice(service, cls); });
        return cls;
    };
}