import { computed, signal } from '@angular/core'
import { Subject } from 'rxjs'

/**
 * Stand-in for SocketService in component specs. The real one opens a socket.io
 * connection from the test runner; this exposes the same signal surface so
 * templates render, and records what was emitted so specs can assert on it.
 */
export class SocketServiceStub {
	public readonly emitted: Array<{ event: string; args: any[] }> = []

	public readonly socket = {
		emit: (event: string, ...args: any[]) => this.emitted.push({ event, args }),
		on: () => {},
		off: () => {},
		once: () => {},
	}

	public readonly connected = signal(true)
	public readonly devices = signal<any[]>([])
	public readonly cameraModels = signal<any[]>([])
	public readonly device_states = signal<any[]>([])
	public readonly listenerClients = signal<any[]>([])
	public readonly vmixClients = signal<any[]>([])
	public readonly sources = signal<any[]>([])
	public readonly busOptions = signal<any[]>([])
	public readonly busOptionsVisible = computed(() => this.busOptions().filter((b) => b.visible !== false))
	public readonly remoteErrorOpt = signal(true)
	public readonly initialDataLoaded = signal(true)
	public readonly version = signal<string | undefined>('test')
	public readonly uiVersion = signal<string | undefined>('test')
	public readonly externalAddress = signal<string | undefined>('http://0.0.0.0:4455/#/tally')
	public readonly interfaces = signal<any[]>([])
	public readonly logs = signal<any[]>([])
	public readonly tallyData = signal<any[]>([])
	public readonly sourceTypes = signal<any[]>([])
	public readonly sourceTypeDataFields = signal<any[]>([])
	public readonly testModeOn = signal(false)
	public readonly testModeInterval = signal(1000)
	public readonly tslclients_1secupdate = signal<boolean | undefined>(false)
	public readonly chatEnabled = signal(true)
	public readonly deviceSources = signal<any[]>([])
	public readonly addresses = signal<any>({})
	public readonly deviceActions = signal<any[]>([])
	public readonly outputTypes = signal<any[]>([])
	public readonly outputTypeDataFields = signal<any[]>([])
	public readonly tslClients = signal<any[]>([])
	public readonly cloudDestinations = signal<any[]>([])
	public readonly cloudKeys = signal<string[]>([])
	public readonly cloudClients = signal<any[]>([])
	public readonly portsInUse = signal<any[]>([])
	public readonly networkDiscovery = signal<any[]>([])
	public readonly messages = signal<any[]>([])
	public readonly errorReports = signal<any[]>([])
	public readonly users = signal<any[]>([])
	public readonly defaultPasswordUsers = signal<string[]>([])

	public readonly disconnectedSources = computed(() =>
		this.sources().filter((source: any) => source.enabled && !source.connected),
	)

	public readonly newLogsSubject = new Subject<void>()
	public readonly scrollTallyDataSubject = new Subject<void>()
	public readonly scrollChatSubject = new Subject<void>()
	public readonly closeModals = new Subject<void>()
	public readonly deviceStateChanged = new Subject<any[]>()
	public readonly deviceDuplicated = new Subject<void>()

	public readonly dataLoaded = Promise.resolve()

	public getSourceById(sourceId: string) {
		return this.sources().find((s) => s.id === sourceId)
	}

	public joinAdmins() {}
	public joinProducers() {}
	public sendAccessToken() {}

	public setTestMode(on: boolean, interval = 1000) {
		this.socket.emit('testmode', on, interval)
		this.testModeOn.set(on)
	}

	public setChatEnabled(enabled: boolean) {
		this.chatEnabled.set(enabled)
	}

	public setTslClients1SecUpdate(enabled: boolean) {
		this.tslclients_1secupdate.set(enabled)
	}

	public lastEmit(event: string) {
		return [...this.emitted].reverse().find((e) => e.event === event)
	}
}
