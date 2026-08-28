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

const REFRESH_DEBOUNCE = 250

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
	private monitoredScreens = new Set<number>()

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
		const [screens, layers, interfaces] = await Promise.all([
			this.apiGet('/screen/list-detail'),
			this.apiGet('/layers/list-detail'),
			this.apiGet('/interface/list-detail'),
		])
		this.resolveMonitoredScreens(screens?.list || [])
		this.registerInputs(interfaces?.list || [])
		this.computeTally(layers?.list || [])
	}

	private resolveMonitoredScreens(screens: any[]): void {
		const realScreens = screens.filter((screen) => screen?.screenIdObj?.type === SCREEN_TYPE_NORMAL)
		const configured = String(this.source.data.screens || '').trim()

		if (!configured) {
			this.monitoredScreens = new Set(realScreens.map((screen) => screen.screenId))
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
				logger(`Source: ${this.source.name}  No screen named or numbered '${wanted}'.`, 'error')
			}
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
		const bussesByAddress: Record<string, string[]> = {}

		for (const layer of layers) {
			const idObj = layer?.layerIdObj
			if (!idObj || !this.monitoredScreens.has(idObj.attachScreenId)) continue
			// A disabled layer still holds its source, so it has to be skipped explicitly or
			// every input ever placed on the screen would read as live.
			if (layer.enable !== 1) continue

			const general = layer.source?.general
			if (!general?.sourceId) continue

			const bus =
				idObj.sceneType === SCENE_PROGRAM ? 'program' : idObj.sceneType === SCENE_PREVIEW ? 'preview' : undefined
			if (!bus) continue

			// sourceId is not unique on its own -- 2:7 is an input and 5:7 is a different
			// source entirely -- so the type has to be part of the address.
			const address = `${general.sourceType}:${general.sourceId}`
			// Sources the interface list does not cover, such as a screen used as the input to
			// another screen, still have to be listable before they can be mapped to a device.
			this.addAddress(general.sourceName || address, address)

			if (!bussesByAddress[address]) bussesByAddress[address] = []
			if (!bussesByAddress[address].includes(bus)) bussesByAddress[address].push(bus)
		}

		// Every known address is rewritten, not just the ones that appear above. This source
		// always works from a whole snapshot, so anything absent from it has genuinely gone
		// dark -- emitting only the changes would leave those addresses latched on.
		for (const entry of this.addresses.value) {
			this.setBussesForAddress(entry.address, bussesByAddress[entry.address] || [])
		}
		this.sendTallyData()
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

		let tag: number
		try {
			// Binary TLV: a 40 byte prefix, then a JSON header whose length is a uint16 at
			// offset 38, then the tag as a uint32. Only the tag is read. The payload is an
			// incremental change that would have to be merged into a full device model to be
			// useful, and re-reading the lists instead gives a snapshot that is internally
			// consistent -- which matters, because a take moves several layers at once.
			tag = frame.readUInt32LE(40 + frame.readUInt16LE(38))
		} catch (error) {
			return // a frame shorter than its own header claims; nothing to act on
		}

		if (!TALLY_RELEVANT_TAG_FAMILIES.includes(Math.floor(tag / 1000))) return
		this.scheduleRefresh()
	}

	private scheduleRefresh(): void {
		if (this.refreshTimer) return
		this.refreshTimer = setTimeout(() => {
			this.refreshTimer = undefined
			void this.runRefresh()
		}, REFRESH_DEBOUNCE)
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
		if (this.ws) {
			this.ws.close()
			this.ws = undefined
		}
	}
}
