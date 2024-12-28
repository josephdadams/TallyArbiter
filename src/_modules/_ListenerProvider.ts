import { EventEmitter } from 'events'

export abstract class ListenerProvider extends EventEmitter {
	public start(): void {}
}
