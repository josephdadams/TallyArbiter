import { BehaviorSubject } from 'rxjs'
import { Port } from '../_models/Port'

export const PortsInUse: BehaviorSubject<Port[]> = new BehaviorSubject<Port[]>([])
