import { logger } from '..'
import { RegisterTallyInput } from '../_decorators/RegisterTallyInput.decorator'
import { Source } from '../_models/Source'
import { TallyInput } from './_Source'
import WebSocket from 'ws'

// Analog Way LivePremier / Aquilon (the AWJ platform). This is a different
// platform from the older Livecore processors in AnalogWayLivecore.ts and
// speaks a different protocol, hence a separate source type.
//
// LivePremier has no tally/UMD protocol. Each input instead carries isOnProgram
// and isOnPreview booleans, which the device already unions across every screen
// and aux, so one flag pair per input answers "live/next on any output". These
// track routing rather than on-screen visibility: an input on a hidden layer
// (e.g. zero opacity) still reads on-air, matching the device's own Web RCS.
//
// The Web RCS port also serves a plain WebSocket (ws://<host>:<port>) that
// streams device-model changes as JSON frames on a "DEVICE" channel, e.g.
//   {"channel":"DEVICE","data":{"path":["device","inputList","items","IN_5",
//     "status","pp","isOnProgram"],"value":true}}
// The socket only sends changes, never a snapshot on connect, so an input that
// is already on-air when Tally Arbiter connects tallies on its next change.

const INPUT_KEY = /^IN_(\d+)$/

interface InputState {
	program: boolean
	preview: boolean
}

@RegisterTallyInput(
	'c7e1a94f',
	'Analog Way LivePremier',
	'For LivePremier / Aquilon (AWJ), firmware 6.1.60 or later. Use the same IP and port as the Web RCS. Source addresses are the input number.',
	[
		{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
		// 'number', not 'port': this is the remote Web RCS port we connect to, not a
		// local port we bind, so it must skip the in-use check (the Web RCS is often 80).
		{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'number' },
	],
)
export class AWLivePremierSource extends TallyInput {
	private ws: WebSocket | undefined
	private inputs: Record<string, InputState> = {}
	private closing = false

	constructor(source: Source) {
		super(source)
		this.connect()
	}

	private connect(): void {
		this.closing = false
		const url = `ws://${this.source.data.ip}:${this.source.data.port}`
		logger(`Source: ${this.source.name}  Connecting to Analog Way LivePremier at ${url}.`, 'info-quiet')

		const ws = new WebSocket(url)
		this.ws = ws

		ws.on('open', () => this.connected.next(true))
		ws.on('message', (data) => this.handleMessage(data.toString()))
		ws.on('error', (error) => {
			// Aborting a socket that is still connecting emits an error; ignore it
			// during teardown so it can never surface as an unhandled 'error'.
			if (this.closing) return
			logger(`Source: ${this.source.name}  Analog Way LivePremier connection error: ${error}`, 'error')
		})
		ws.on('close', () => {
			if (this.ws !== ws) return // a socket we already replaced
			this.ws = undefined
			if (!this.closing) this.connected.next(false) // let the base class reconnect
		})
	}

	private handleMessage(raw: string): void {
		let message: any
		try {
			message = JSON.parse(raw)
		} catch (e) {
			return
		}
		// Only the DEVICE channel carries the per-input flags, one leaf per frame.
		if (message?.channel !== 'DEVICE' || !message.data || !Array.isArray(message.data.path)) return

		// Path shape: [..., "items", "IN_<n>", ..., "<leaf>"].
		const path: any[] = message.data.path
		const itemsIndex = path.indexOf('items')
		if (itemsIndex === -1) return
		const keyMatch = INPUT_KEY.exec(String(path[itemsIndex + 1] ?? ''))
		if (!keyMatch) return

		const address = keyMatch[1]
		const leaf = String(path[path.length - 1])
		const value = message.data.value

		switch (leaf) {
			case 'isOnProgram':
				this.registerInput(address).program = Boolean(value)
				this.sendInputTally(address)
				break
			case 'isOnPreview':
				this.registerInput(address).preview = Boolean(value)
				this.sendInputTally(address)
				break
			case 'label':
				// Surface the device's own input name instead of a bare number.
				this.ensureInput(address)
				this.addAddress(String(value) || `Input ${address}`, address)
				break
		}
	}

	private ensureInput(address: string): InputState {
		if (!this.inputs[address]) this.inputs[address] = { program: false, preview: false }
		return this.inputs[address]
	}

	// As ensureInput, but also list the input (under a placeholder label until
	// its real label frame arrives) so it shows up as an address.
	private registerInput(address: string): InputState {
		const isNew = !this.inputs[address]
		const state = this.ensureInput(address)
		if (isNew) this.addAddress(`Input ${address}`, address)
		return state
	}

	private sendInputTally(address: string): void {
		const state = this.inputs[address]
		const busses: string[] = []
		if (state.program) busses.push('program')
		if (state.preview) busses.push('preview')
		this.sendIndividualTallyData(address, busses)
	}

	public reconnect(): void {
		this.connect()
	}

	public exit(): void {
		super.exit()
		this.closing = true
		if (this.ws) {
			const ws = this.ws
			this.ws = undefined
			// Keep the 'error' listener attached (it ignores errors while closing)
			// so terminating a still-connecting socket can't raise an unhandled
			// 'error'. terminate() aborts a pending connection immediately.
			ws.removeAllListeners('open')
			ws.removeAllListeners('message')
			ws.removeAllListeners('close')
			ws.terminate()
		}
		this.connected.next(false)
	}
}
