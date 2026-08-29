import axios from 'axios'
import jwt from 'jsonwebtoken'
import WebSocket from 'ws'
import { logger } from '..'
import { RegisterTallyInput } from '../_decorators/RegisterTallyInput.decorator'
import { Source } from '../_models/Source'
import { TallyInput } from './_Source'

// Pixelhue Q8 (the "unico" platform, shared with the P10/P20/P80 but only verified
// against a Q8 here). The device has no tally or UMD protocol of its own, so tally is
// derived from its layer model: a screen holds a program scene and a preview scene,
// each a set of layers, and every layer names the input it displays. An input is live
// when some enabled layer on a program scene of a monitored screen carries it.
//
// Two ports are involved. The REST API is plain HTTP on the port the device advertises
// (8088 on a Q8), while the change-notification WebSocket is TLS on a fixed 19998 with
// a self-signed certificate.
//
// Authentication is a JWT the client mints for itself: GET /unico/v1/node/open-detail
// returns the serial and the device's boot time, and the token is {SN} signed with that
// boot time. Nothing secret is involved, but the boot time changes on reboot, so the
// token has to be re-minted on every connect rather than cached across one.

const UCENTER_PORT = 19998
const DEFAULT_API_PORT = 8088

// layerIdObj.sceneType. The device's own web UI labels 2 as PGM and 4 as PVW.
const SCENE_PROGRAM = 2
const SCENE_PREVIEW = 4

// screenIdObj.type. 8 is the multiviewer, which carries every input permanently and
// would therefore tally the whole rack at once; 16 is an aux. Only 2 is a real screen.
const SCREEN_TYPE_NORMAL = 2

// auxiliaryInfo.connectorInfo.interfaceType: 2 is an input, 4 an output, 16 the MVR.
const INTERFACE_TYPE_INPUT = 2

// The device returns this in a 200 body when the token no longer matches its boot time.
const ERROR_BAD_TOKEN = 8273

// Tag families on the notification socket: 463xxx screens, 528xxx/529xxx layers,
// 663xxx presets and layer sets. Everything else is telemetry -- temperatures, CPU
// load, thumbnail progress -- which arrives several times a second whether or not
// anything switched.
const TALLY_RELEVANT_TAG_FAMILIES = [463, 528, 529, 663]

// A take arrives as a burst of frames -- measured at three over ~250ms -- and the device
// applies the swap on the last of them, having first reported the scene it is rebuilding
// as briefly empty. Reading must therefore wait for the burst to stop rather than for a
// fixed delay after it starts: anchoring to the first frame means either racing the swap
// or over-waiting by the length of the burst, which is felt directly as tally lag.
//
// So the wait restarts on every frame, and a read happens once the device has been quiet
// for this long.
const REFRESH_TRAILING = 150

// ...but a continuous stream of frames must not starve the read entirely. Dragging a layer
// in the device's own UI emits frames every few milliseconds and would otherwise postpone
// tally for as long as the operator kept dragging, so a read is forced this long after the
// first frame still waiting to be served.
const REFRESH_MAX_WAIT = 1000

// The take. Its payload names the screens involved and the length of the effect, and it
// arrives twice: status 0 as the transition starts and status 1 once it has finished.
const TAG_TAKE = 463618
const TAKE_STARTING = 0

// Fallback only, in case the status 1 frame never arrives: how long past the effect's own
// duration to hold the transition before settling anyway.
const TRANSITION_MARGIN = 150

// The input list is large and effectively static during a show, so it is not re-read on
// every transition. The cost is that renaming an input on the device takes up to this long
// to reach the address list.
const INTERFACE_REREAD = 30000

@RegisterTallyInput(
	'8f2ad4e1',
	'Pixelhue Q8',
	'Source addresses are the input number as the device reports it. Leave Screens blank to follow every screen, or list the ones that should drive tally by name or number, separated by commas.',
	[
		{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
		// 'number', not 'port': this is a remote port we connect to, not a local one we
		// bind, so it must skip the in-use check. 8088 on a Q8.
		{ fieldName: 'port', fieldLabel: 'API Port', fieldType: 'number' },
		{
			fieldName: 'screens',
			fieldLabel: 'Screens',
			fieldType: 'text',
			optional: true,
			help: 'Comma separated screen names or numbers, e.g. "Portrait HL, Portrait HR". Blank follows every screen. The multiviewer is never followed, because every input sits on it permanently.',
		},
	],
)
export class PixelhueQ8Source extends TallyInput {
	private ws: WebSocket | undefined
	private token = ''
	private closing = false
	private refreshTimer: NodeJS.Timeout | undefined
	private refreshing = false
	private refreshQueued = false
	private pendingSince = 0
	private lastInterfaceRead = 0
	private monitoredScreens = new Set<number>()
	// Kept per screen rather than flattened, so that a take affecting one screen cannot put
	// the other screen's incoming layers on program.
	private screenProgram = new Map<number, Set<string>>()
	private screenPreview = new Map<number, Set<string>>()
	private transitionTimer: NodeJS.Timeout | undefined
	private inTransitionUntil = 0
	// Only log the available screens when the set changes, not on every refresh.
	private lastScreenList = ''

	constructor(source: Source) {
		super(source)
		void this.connect()
	}

	private get apiBase(): string {
		return `http://${this.source.data.ip}:${this.source.data.port || DEFAULT_API_PORT}/unico/v1`
	}

	private async connect(): Promise<void> {
		this.closing = false
		try {
			await this.mintToken()
			await this.refreshNow()
			this.openSocket()
		} catch (error) {
			logger(`Source: ${this.source.name}  Pixelhue connection failed: ${error}`, 'error')
			this.connected.next(false)
		}
	}

	private async mintToken(): Promise<void> {
		const response = await axios.get(`${this.apiBase}/node/open-detail`, { timeout: 5000 })
		const detail = response.data?.data
		if (!detail?.sn || !detail?.startTime) {
			throw new Error('open-detail did not return a serial and start time')
		}
		this.token = jwt.sign({ SN: detail.sn }, String(detail.startTime), { algorithm: 'HS256', noTimestamp: true })
	}

	private async apiGet(path: string, allowRetry = true): Promise<any> {
		const response = await axios.get(`${this.apiBase}${path}`, {
			headers: { Authorization: this.token },
			timeout: 8000,
		})
		// A rejected token comes back as a 200 with an error code in the body, and it means
		// the device rebooted underneath us. Re-mint once instead of dropping the source.
		if (response.data?.code === ERROR_BAD_TOKEN && allowRetry) {
			await this.mintToken()
			return this.apiGet(path, false)
		}
		if (response.data?.code !== 0) {
			throw new Error(`${path} returned code ${response.data?.code}`)
		}
		return response.data.data
	}

	private async refreshNow(): Promise<void> {
		const readInterfaces = Date.now() - this.lastInterfaceRead > INTERFACE_REREAD
		const [screens, layers, interfaces] = await Promise.all([
			this.apiGet('/screen/list-detail'),
			this.apiGet('/layers/list-detail'),
			readInterfaces ? this.apiGet('/interface/list-detail') : Promise.resolve(null),
		])
		this.resolveMonitoredScreens(screens?.list || [])
		if (interfaces) {
			this.registerInputs(interfaces.list || [])
			this.lastInterfaceRead = Date.now()
		}
		this.computeTally(layers?.list || [])
	}

	// The Screens field has to be typed by hand, so the screens the device actually offers are
	// logged the first time they are seen and named again whenever an entry does not match.
	// Without that there is no way to discover what to type except opening the device's own UI.
	private describeScreens(screens: any[]): string {
		return screens.map((screen) => `${screen.screenId} "${screen.general?.name || '(unnamed)'}"`).join(', ')
	}

	private resolveMonitoredScreens(screens: any[]): void {
		const realScreens = screens.filter((screen) => screen?.screenIdObj?.type === SCREEN_TYPE_NORMAL)
		const configured = String(this.source.data.screens || '').trim()

		const seen = realScreens.map((screen) => screen.screenId).join(',')
		if (seen !== this.lastScreenList) {
			this.lastScreenList = seen
			logger(
				`Source: ${this.source.name}  Screens available: ${this.describeScreens(realScreens) || '(none)'}.`,
				'info',
			)
		}

		if (!configured) {
			this.monitoredScreens = new Set(realScreens.map((screen) => screen.screenId))
			logger(`Source: ${this.source.name}  Following every screen, because Screens is blank.`, 'info-quiet')
			return
		}

		const selected = new Set<number>()
		for (const entry of configured.split(',')) {
			const wanted = entry.trim()
			if (!wanted) continue
			const match = realScreens.find(
				(screen) =>
					String(screen.screenId) === wanted ||
					String(screen.general?.name || '').toLowerCase() === wanted.toLowerCase(),
			)
			if (match) {
				selected.add(match.screenId)
			} else {
				logger(
					`Source: ${this.source.name}  No screen named or numbered '${wanted}'. Available: ${this.describeScreens(realScreens) || '(none)'}.`,
					'error',
				)
			}
		}

		if (!selected.size) {
			logger(
				`Source: ${this.source.name}  Screens matched nothing, so no tally will be reported. Available: ${this.describeScreens(realScreens) || '(none)'}.`,
				'error',
			)
		}
		this.monitoredScreens = selected
	}

	private registerInputs(interfaces: any[]): void {
		for (const iface of interfaces) {
			if (iface?.auxiliaryInfo?.connectorInfo?.interfaceType !== INTERFACE_TYPE_INPUT) continue
			const name = iface.general?.name
			if (!name) continue
			this.addAddress(name, `${INTERFACE_TYPE_INPUT}:${iface.interfaceId}`)
		}
	}

	private computeTally(layers: any[]): void {
		const program = new Map<number, Set<string>>()
		const preview = new Map<number, Set<string>>()

		for (const layer of layers) {
			const idObj = layer?.layerIdObj
			if (!idObj || !this.monitoredScreens.has(idObj.attachScreenId)) continue
			// A disabled layer still holds its source, so it has to be skipped explicitly or
			// every input ever placed on the screen would read as live.
			if (layer.enable !== 1) continue

			const general = layer.source?.general
			if (!general?.sourceId) continue

			const into = idObj.sceneType === SCENE_PROGRAM ? program : idObj.sceneType === SCENE_PREVIEW ? preview : undefined
			if (!into) continue

			// sourceId is not unique on its own -- 2:7 is an input and 5:7 is a different
			// source entirely -- so the type has to be part of the address.
			const address = `${general.sourceType}:${general.sourceId}`
			// Sources the interface list does not cover, such as a screen used as the input to
			// another screen, still have to be listable before they can be mapped to a device.
			this.addAddress(general.sourceName || address, address)

			const screen = idObj.attachScreenId
			if (!into.has(screen)) into.set(screen, new Set())
			into.get(screen).add(address)
		}

		this.screenProgram = program
		this.screenPreview = preview
		this.publish()
	}

	/**
	 * Publish the whole tally map.
	 *
	 * `alsoOnProgram` carries the screens mid-fade, whose incoming layers have to read as
	 * on air even though the device still lists them under preview.
	 */
	private publish(alsoOnProgram?: Map<number, Set<string>>): void {
		const busses: Record<string, string[]> = {}
		const put = (address: string, bus: string) => {
			if (!busses[address]) busses[address] = []
			if (!busses[address].includes(bus)) busses[address].push(bus)
		}
		for (const addresses of this.screenProgram.values()) for (const a of addresses) put(a, 'program')
		for (const addresses of this.screenPreview.values()) for (const a of addresses) put(a, 'preview')
		if (alsoOnProgram) for (const addresses of alsoOnProgram.values()) for (const a of addresses) put(a, 'program')

		// Every known address is rewritten, not just the ones that appear above. This source
		// always works from a whole snapshot, so anything absent from it has genuinely gone
		// dark -- emitting only the changes would leave those addresses latched on.
		for (const entry of this.addresses.value) {
			this.setBussesForAddress(entry.address, busses[entry.address] || [])
		}
		this.sendTallyData()
	}

	/**
	 * A fade puts the incoming layers on screen the moment it starts and keeps the outgoing
	 * ones there until it ends, so for its whole duration both are genuinely on air. Camera
	 * operators need the incoming tally at the start of the fade, not at the end of it.
	 *
	 * The device does not report it that way -- it moves program to the new scene partway
	 * through -- so for the duration of the transition both sides are published, and normal
	 * refreshes are suppressed so nothing overwrites that until the take completes.
	 */
	private beginTransition(screenIds: number[], effectMs: number): void {
		const incoming = new Map<number, Set<string>>()
		for (const id of screenIds) {
			const layers = this.screenPreview.get(id)
			if (layers?.size) incoming.set(id, layers)
		}

		const hold = effectMs + TRANSITION_MARGIN
		this.inTransitionUntil = Date.now() + hold
		// Drop any read already pending, which would land mid-fade and undo the union.
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer)
			this.refreshTimer = undefined
			this.pendingSince = 0
		}
		if (incoming.size) this.publish(incoming)

		if (this.transitionTimer) clearTimeout(this.transitionTimer)
		this.transitionTimer = setTimeout(() => this.endTransition(), hold)
	}

	private endTransition(): void {
		if (this.transitionTimer) {
			clearTimeout(this.transitionTimer)
			this.transitionTimer = undefined
		}
		this.inTransitionUntil = 0
		this.scheduleRefresh()
	}

	private openSocket(): void {
		const url = `wss://${this.source.data.ip}:${UCENTER_PORT}/unico/v1/ucenter/ws?client-type=8`
		logger(`Source: ${this.source.name}  Connecting to Pixelhue at ${url}.`, 'info-quiet')

		// The device serves this with a self-signed certificate, so it can never validate.
		const ws = new WebSocket(url, { headers: { Authorization: this.token }, rejectUnauthorized: false })
		this.ws = ws

		ws.on('open', () => this.connected.next(true))
		ws.on('message', (data) => this.handleFrame(data as Buffer))
		ws.on('error', (error) => {
			// Aborting a socket that is still connecting emits an error; ignore it during
			// teardown so it can never surface as an unhandled 'error'.
			if (this.closing) return
			logger(`Source: ${this.source.name}  Pixelhue connection error: ${error}`, 'error')
		})
		ws.on('close', () => {
			if (this.ws !== ws) return // a socket we already replaced
			this.ws = undefined
			if (!this.closing) this.connected.next(false) // let the base class reconnect
		})
	}

	private handleFrame(frame: Buffer): void {
		if (!Buffer.isBuffer(frame)) return

		let tag: number, headerEnd: number
		try {
			// Binary TLV: a 40 byte prefix, then a JSON header whose length is a uint16 at
			// offset 38, then the tag as a uint32. For everything except the take only the tag
			// is read: those payloads are incremental changes that would have to be merged into
			// a full device model to be useful, and re-reading the lists instead gives a
			// snapshot that is internally consistent -- which matters, because a take moves
			// several layers at once.
			headerEnd = 40 + frame.readUInt16LE(38)
			tag = frame.readUInt32LE(headerEnd)
		} catch (error) {
			return // a frame shorter than its own header claims; nothing to act on
		}

		if (tag === TAG_TAKE) {
			try {
				const start = headerEnd + 8
				const length = (frame.readUInt16LE(headerEnd + 4) << 16) + frame.readUInt16LE(headerEnd + 6)
				this.handleTake(JSON.parse(frame.subarray(start, start + length).toString() || '{}'))
			} catch (error) {
				// Unreadable take payload: fall back to just re-reading once it has settled.
				this.endTransition()
			}
			return
		}

		if (!TALLY_RELEVANT_TAG_FAMILIES.includes(Math.floor(tag / 1000))) return
		// Mid-fade the union is deliberately being held; a read now would undo it.
		if (Date.now() < this.inTransitionUntil) return
		this.scheduleRefresh()
	}

	private handleTake(data: any): void {
		const screenIds: number[] = (data?.screenList || [])
			.map((s: any) => s?.screenId)
			.filter((id: number) => this.monitoredScreens.has(id))
		// A take on screens we do not follow changes nothing we report.
		if (!screenIds.length) return

		const effectMs = Number(data?.switchEffect?.time) || 0
		// status 0 opens the transition, status 1 closes it. A cut has no effect time, so
		// there is no window during which both sides are on screen -- settle immediately.
		if (data?.status === TAKE_STARTING && effectMs > 0) {
			this.beginTransition(screenIds, effectMs)
		} else {
			this.endTransition()
		}
	}

	private scheduleRefresh(): void {
		const now = Date.now()

		// Leading edge. The first frame after a quiet spell is served straight away, so a cut
		// reaches tally as fast as the device can be read rather than waiting to find out
		// whether more frames are coming. If that read catches the device mid-change -- it
		// sometimes announces a change slightly before applying it -- the worst case is
		// publishing the state that is already displayed, which changes nothing, and the
		// trailing read below corrects it.
		if (!this.pendingSince) {
			this.pendingSince = now
			void this.runRefresh()
		}

		// Trailing edge. Restart the wait on every frame so the confirming read lands after
		// the burst rather than a fixed delay into it, but never push it past
		// REFRESH_MAX_WAIT from the first frame still waiting to be served.
		if (this.refreshTimer) clearTimeout(this.refreshTimer)
		const wait = Math.max(0, Math.min(REFRESH_TRAILING, this.pendingSince + REFRESH_MAX_WAIT - now))
		this.refreshTimer = setTimeout(() => {
			this.refreshTimer = undefined
			this.pendingSince = 0
			void this.runRefresh()
		}, wait)
	}

	private async runRefresh(): Promise<void> {
		// Dragging a layer in the device's UI emits a frame every few milliseconds. Holding
		// bursts behind one in-flight fetch keeps that from queueing hundreds of snapshots.
		if (this.refreshing) {
			this.refreshQueued = true
			return
		}
		this.refreshing = true
		try {
			await this.refreshNow()
		} catch (error) {
			logger(`Source: ${this.source.name}  Pixelhue refresh failed: ${error}`, 'error')
		} finally {
			this.refreshing = false
			if (this.refreshQueued) {
				this.refreshQueued = false
				this.scheduleRefresh()
			}
		}
	}

	public reconnect(): void {
		void this.connect()
	}

	public exit(): void {
		super.exit()
		this.closing = true
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer)
			this.refreshTimer = undefined
		}
		if (this.transitionTimer) {
			clearTimeout(this.transitionTimer)
			this.transitionTimer = undefined
		}
		if (this.ws) {
			this.ws.close()
			this.ws = undefined
		}
	}
}
