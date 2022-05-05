import 'reflect-metadata';
import { TallyInputType } from "../_types/TallyInputType";
import { RegisteredNetworkDiscoveryServices } from "../_globals/RegisteredNetworkDiscoveryServices";
import { ListenerProviderType } from '../_types/ListenerProviderType';
import { NetworkDiscovery } from '../_models/NetworkDiscovery';
import { logger } from '..';


function addDiscoveredDevice(service: NetworkDiscovery, cls: TallyInputType | ListenerProviderType) {
    let sourceId = Reflect.getMetadata("sourceId", cls);
    service.sourceId = sourceId;
    logger(`Found Device via MDNS: ${service.name} (${service.addresses.join(" / ")})`);
    RegisteredNetworkDiscoveryServices.next(RegisteredNetworkDiscoveryServices.value.concat(service));
}

export function RegisterNetworkDiscovery(callback: (addDiscoveredDevice) => void): (cls: TallyInputType | ListenerProviderType) => void {
    return (cls: TallyInputType | ListenerProviderType) => {
        callback((service: NetworkDiscovery) => { addDiscoveredDevice(service, cls); });
        return cls;
    };
}