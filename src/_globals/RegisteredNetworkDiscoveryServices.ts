import { BehaviorSubject } from 'rxjs'
import { NetworkDiscovery } from '../_models/NetworkDiscovery'

export const RegisteredNetworkDiscoveryServices: BehaviorSubject<NetworkDiscovery[]> = new BehaviorSubject<
	NetworkDiscovery[]
>([])
