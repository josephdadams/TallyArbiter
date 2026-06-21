/**
 * Grass Valley K-Frame (ETP) Source Type for Tally Arbiter
 * --------------------------------------------------------
 * Protocol: GV Ethernet Tally Protocol (ETP), XML-ish messages over TCP.
 *
 * What this implementation does:
 *  - Connects to the K-Frame over TCP (default port 2012).
 *  - Sends an Authentication-Request (<ETP><Authentication-Request>...) with Suite=All.
 *  - Maintains a fixed 5s heartbeat (sends <Heartbeat/>, responds to <Heartbeat-Request/>).
 *  - Tokenizes the TCP stream into <ETP>...</ETP> frames (safe against TCP fragmentation).
 *  - Parses a few core messages using xml2js:
 *      • LogicalSourceMap    → builds/updates the "inputs" list (logical source id → name).
 *      • OutputTally         → buffers output→source mappings until SetComplete.
 *      • SetComplete         → commit point: apply Program/Preview to TA busses and publish.
 *      • Heartbeat-Request   → replies with Heartbeat.
 *      • Authentication      → clears state for a fresh "Full" dump.
 *  - Lets the operator choose which Output numbers (OutNum) are Program and Preview
 *    using simple dropdowns, not regex. This maps directly to OutputTally rows.
 *
 * Notes:
 *  - Heartbeat is fixed at 5000 ms (you can lift that to config if you run into frame idiosyncrasies).
 *  - We do a full "clear" of TA busses on each SetComplete to ensure consistency; then apply the
 *    currently active Program/Preview sources based on your selected outputs.
 */

import { device_sources, logger } from '..'
import { RegisterTallyInput } from '../_decorators/RegisterTallyInput.decorator'
import { Source } from '../_models/Source'
import { TallyInput } from './_Source'
import { TallyInputConfigField } from '../_types/TallyInputConfigField'
import net from 'net'
import xml2js from 'xml2js'

import path from 'path'
import fs from 'fs'

import { version } from '../../package.json'

/** TA config fields shown in the UI for this source type. */
const GV_ETP_FIELDS: TallyInputConfigField[] = [
	{ fieldName: 'ip', fieldLabel: 'K-Frame IP Address', fieldType: 'text' },
	{ fieldName: 'port', fieldLabel: 'TCP Port (default 2012)', fieldType: 'port' },
	{
		fieldName: 'suite',
		fieldLabel: 'Suite Number',
		fieldType: 'dropdown',
		options: [
			{ id: '1', label: '1' },
			{ id: '2', label: '2' },
			{ id: '3', label: '3' },
			{ id: '4', label: '4' },
		],
	},
	{
		fieldName: 'me',
		fieldLabel: 'ME to Monitor',
		fieldType: 'dropdown',
		options: [
			{ id: 'PGM', label: 'PGM/PST' },
			{ id: 'ME1', label: 'ME 1' },
			{ id: 'ME2', label: 'ME 2' },
			{ id: 'ME3', label: 'ME 3' },
			{ id: 'ME4', label: 'ME 4' },
		],
	},
	{
		fieldName: 'pgm_bus',
		fieldLabel: 'Program Bus',
		fieldType: 'dropdown',
		options: [
			{ id: 'PgmA', label: 'Program A' },
			{ id: 'PgmB', label: 'Program B' },
			{ id: 'PgmC', label: 'Program C' },
			{ id: 'PgmD', label: 'Program D' },
		],
	},
	{
		fieldName: 'pvw_bus',
		fieldLabel: 'Preview Bus',
		fieldType: 'dropdown',
		options: [
			{ id: 'PvwA', label: 'Preview A' },
			{ id: 'PvwB', label: 'Preview B' },
			{ id: 'PvwC', label: 'Preview C' },
			{ id: 'PvwD', label: 'Preview D' },
		],
	},
]

@RegisterTallyInput('f15e43b1', 'Grass Valley K-Frame (ETP)', 'GV Ethernet Tally Protocol', GV_ETP_FIELDS)
export class GrassValleyETP extends TallyInput {
	/** Raw TCP socket to the K-Frame */
	private client: net.Socket

	/** TCP port (defaults to 2012) */
	private port: number

	/** Rolling buffer that collects bytes until we find complete <ETP>...</ETP> frames */
	private rxBuf = ''

	/** Selected suite number */
	private suite: string

	/** Dropdown-selected "Program" and "Preview" Output numbers (string compare) */
	private me: string

	/** Selected Program and Preview bus */
	private pgm_bus: string
	private pvw_bus: string

	private logicalSourceMap: Map<string, string> = new Map() // id → name

	// Maps VPE input names (key1-fill, BkgdA, etc) → logical source ID
	private vpeInputContributions: Map<string, string> = new Map()

	// Cache of last received VPEOutputContribution for re-application on input changes
	private lastVpeOutputContribution: any = null

	// map logical sources to engineering sources
	private logicalToEngineeringMap = new Map<string, string>() // logical ID → ENG ID
	private engineeringSourceMap: Map<string, string> = new Map()

	/** Fixed heartbeat timer handle (5000ms) */
	private heartbeatTimer?: NodeJS.Timeout

	constructor(source: Source) {
		super(source)

		this.client = new net.Socket()
		this.port = Number(source.data.port || 2012)

		this.suite = source.data.suite || '1'
		this.me = source.data.me || 'PGM'
		this.pgm_bus = source.data.pgm_bus || 'PgmA'
		this.pvw_bus = source.data.pvw_bus || 'PvwA'

		this.logicalSourceMap = new Map()
		this.vpeInputContributions = new Map()

		this.client.on('connect', () => {
			logger(`Source: ${source.name}  Grass Valley ETP connected`, 'info-quiet')
			this.connected.next(true)
			this.sendAuthenticationRequest() // "Hello", ask for Suite=All
			this.startHeartbeat() // fixed 5s heartbeat
		})

		this.client.on('data', (data: Buffer) => {
			this.rxBuf += safeAscii(data.toString('utf8'))
			this.consumeFrames() // try to extract and handle complete <ETP>...</ETP> messages
		})

		this.client.on('close', () => {
			this.connected.next(false)
			this.stopHeartbeat()
		})

		this.client.on('error', (err) => {
			logger(`Source: ${source.name}  ETP TCP error: ${err}`, 'error')
		})

		this.connect()
	}

	/** Open/renew the TCP connection */
	private connect(): void {
		this.client.connect({ port: this.port, host: this.source.data.ip })
	}

	/** TA calls this when it wants us to try again */
	public reconnect(): void {
		this.connect()
	}

	/** Graceful shutdown from TA */
	public exit(): void {
		super.exit()
		this.stopHeartbeat()
		try {
			this.client.end()
		} catch {}
		try {
			this.client.destroy()
		} catch {}
	}

	/* ====================================================================== */
	/*                              Protocol Core                             */
	/* ====================================================================== */

	/** Send the required Authentication-Request to begin an ETP session.
	 *  Suite is hardcoded to "All" per your preference (more data, simpler config).
	 */
	private sendAuthenticationRequest(): void {
		console.log('Sending Authentication-Request to K-Frame')
		const xml =
			`<ETP><Authentication-Request>` +
			`<Protocol>GV Ethernet Tally</Protocol>` + // key string: server will respond with Authentication
			`<ProtocolVersion>3.0</ProtocolVersion>` + // K-Frame replies with <Version>3.0</Version>
			`<AppName>Tally Arbiter</AppName>` + // friendly name
			`<AppVersion>${version}</AppVersion>` + // TA version
			`<Suite>All</Suite>` + // important: subscribe to ALL suites
			`</Authentication-Request></ETP>`

		this.client.write(xml)
	}

	/** Begin fixed 5s heartbeat (keepalive) and also be ready to reply to Heartbeat-Request */
	private startHeartbeat(): void {
		this.stopHeartbeat()
		this.heartbeatTimer = setInterval(() => {
			this.client.write(`<ETP><Heartbeat/></ETP>`)
		}, 5000)
	}

	/** Halt heartbeats (on close/exit) */
	private stopHeartbeat(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer)
			this.heartbeatTimer = undefined
		}
	}

	/* ====================================================================== */
	/*                            Framing / Tokenizer                         */
	/* ====================================================================== */

	/**
	 * Pull as many complete <ETP>...</ETP> frames as possible from rxBuf.
	 * Handles TCP fragmentation (partial frames) and concatenation (multiple frames back-to-back).
	 * If no full frame exists yet, we leave rxBuf as is until more data arrives.
	 */
	private consumeFrames(): void {
		while (true) {
			const start = this.rxBuf.indexOf('<ETP>')
			if (start < 0) {
				this.trimRxBuf()
				return
			}
			const end = this.rxBuf.indexOf('</ETP>', start)
			if (end < 0) {
				this.trimRxBuf()
				return
			}

			const frame = this.rxBuf.slice(start, end + '</ETP>'.length)

			this.rxBuf = this.rxBuf.slice(end + '</ETP>'.length)

			this.handleEtpFrame(frame)
		}
	}

	/** Keep the buffer from growing without bound if a device spews noise */
	private trimRxBuf(): void {
		if (this.rxBuf.length > 2_000_000) {
			this.rxBuf = this.rxBuf.slice(-200_000)
		}
	}

	/* ====================================================================== */
	/*                         ETP Frame Parsing / Dispatch                   */
	/* ====================================================================== */

	/**
	 * Parse one <ETP>...</ETP> frame and dispatch based on the first known child element.
	 * Uses xml2js with explicitArray to normalize shapes and keep simple.
	 */
	private handleEtpFrame(xmlStr: string): void {
		xml2js.parseString(xmlStr, { explicitArray: true, trim: true }, (err, obj) => {
			if (err || !obj) {
				return
			}
			const etp = obj['ETP']
			if (!etp) return

			const tag = pickKnownTag(etp, [
				'Authentication', // server banner → good place to reset state for a "Full" push
				'Authentication-Request', // (we never expect to receive this; client sends it)
				'Heartbeat', // server heartbeat (rare); can ignore
				'Heartbeat-Request', // server asks for heartbeat → respond with <Heartbeat/>
				'LogicalSourceMap', // id/name list of logical sources (use these as "inputs" in TA)
				'EngineeringSourceMap', // id list of engineering sources
				'VPEInputContribution', // maps VPE input names (Bkgd/Key fills/cuts → logical sources)
				'VPEOutputContribution', // describes which VPE inputs contribute to outputs (PgmA/PvwA etc.)
				'OutputTally', // 
				'SetComplete', // **commit point**: publish after a Full/Update batch is finished
			])
			if (!tag) {
				//console.warn('Unknown ETP frame received:', JSON.stringify(etp, null, 2))
				return
			}

			switch (tag) {
				case 'Heartbeat-Request':
					this.client.write(`<ETP><Heartbeat/></ETP>`)
					break

				case 'Authentication':
					console.log('ETP Authentication received')
					break

				case 'LogicalSourceMap':
					//console.log('LogicalSourceMap received')
					this.applyLogicalSourceMap(etp['LogicalSourceMap'][0])
					break

				case 'EngineeringSourceMap':
					//console.log('EngineeringSourceMap received')
					this.applyEngineeringSourceMap(etp['EngineeringSourceMap'][0])
					break

				case 'VPEInputContribution':
					//console.log('VPEInputContribution received')
					this.applyVpeInputContribution(etp['VPEInputContribution'][0])
					break

				case 'VPEOutputContribution':
					//console.log('VPEOutputContribution received')
					this.applyVpeOutputContribution(etp['VPEOutputContribution'][0])
					break

				case 'OutputTally':
					//console.log('OutputTally received')
					break

				case 'SetComplete':
					break

				default:
					break
			}
		})
	}

	/* ====================================================================== */
	/*                          Table Reducers / State                        */
	/* ====================================================================== */

	private applyLogicalSourceMap(node: any): void {
		const rows = toArray(node.LogSrc)

		//only apply if this is our suite
		const suite = node.$.Suite || '1'

		//console.log(`Received Suite: ${suite}`)

		if (suite !== this.suite) {
			//console.log(`[ETP] Suite does not match (expected ${this.suite}, got ${suite}), skipping VPEInputContribution`)
			return
		}

		for (const r of rows) {
			const logicalId = r?.$?.ID?.toString()
			if (!logicalId) continue

			// Still useful for logging/debug
			const name = (r?.Name?.[0] ?? '').toString()
			//if logical id is less than 10, log it to console
			if (parseInt(logicalId) < 10) {
				console.log(`LogicalSourceMap entry: ${logicalId} → ${name}`)
			}
			
			this.logicalSourceMap.set(logicalId, name || logicalId)
		}
	}

	private applyEngineeringSourceMap(node: any): void {
		const rows = toArray(node.EngSrc)

		this.engineeringSourceMap.clear()

		for (const r of rows) {
			const engId = r?.$?.ID?.toString()
			const name = r?.$?.Name?.toString() || engId

			if (!engId) continue

			this.engineeringSourceMap.set(name, engId)

			// UI: show only ENG-based addresses
			this.removeAddress(engId)
			this.addAddress(`${engId} - ${name}`, engId)
		}

		// Sort by ENG ID (numerically if possible)
		this.addresses.next(
			this.addresses.value.sort((a, b) => {
				const aNum = parseInt(a.address)
				const bNum = parseInt(b.address)

				if (isNaN(aNum) || isNaN(bNum)) {
					return a.address.localeCompare(b.address)
				} else {
					return aNum - bNum
				}
			}),
		)
	}

	private applyVpeInputContribution(node: any): void {
		//console.log('[ETP] === applyVpeInputContribution() ===')
		//console.log(`Looking for Suite: ${this.suite}, ME: ${this.me}`)

		const suite = node.$.Suite || '1'

		//console.log(`Received Suite: ${suite}`)

		if (suite !== this.suite) {
			//console.log(`[ETP] Suite does not match (expected ${this.suite}, got ${suite}), skipping VPEInputContribution`)
			return
		}

		//sometimes the data comes in with ALL of the me's, and sometimes just the one that updated, so we need to loop through node.VPE which is an array, and if node.VPE[i].$.Name = our ME, then we process it, otherwise we don't care
		const vpes = toArray(node.VPE)

		let myVpe: any = null

		for (const vpe of vpes) {
			const vpeName = vpe?.$?.Name || ''
			//console.log(`Found VPE Name: ${vpeName}`)
			if (vpeName == this.me) {
				//console.log(`[ETP] Found matching ME: ${this.me}`)
				myVpe = vpe
				break
			}
		}

		if (!myVpe) {
			//console.log(`[ETP] No VPE node matching selected ME (${this.me}), skipping VPEInputContribution`)
			return
		}

		console.log(`[ETP] Applying VPEInputContribution for selected Suite/ME: ${this.suite} / ${this.me}`)

		this.vpeInputContributions.clear()

		//loop through myVpe.Input which is an array and get the assigned source to each particular bus like key1-fill, bkgdA, etc.
		for (const input of toArray(myVpe.Input)) {
			const sourceId = String(input?._ || '')
			const inputName = input?.$?.Name || ''

			if (!sourceId || !inputName) continue

			this.vpeInputContributions.set(inputName, sourceId)

			const sourceLabel = this.logicalSourceMap.get(sourceId) || sourceId

			console.log(`[ETP][InputMap] ${inputName} → ${sourceId} (${sourceLabel})`)
		}

		// Recalculate tally if we have a previous output frame
		if (this.lastVpeOutputContribution) {
			console.log('[ETP] Re-applying cached VPEOutputContribution')
			this.applyVpeOutputContribution(this.lastVpeOutputContribution)
		}
	}

	private applyVpeOutputContribution(node: any): void {
		//console.log('[ETP] === applyVpeOutputContribution() ===')
		//console.log(`Looking for Suite: ${this.suite}, ME: ${this.me}`)

		const suite = node.$.Suite || '1'

		//console.log(`Received Suite: ${suite}`)
		
		if (suite !== this.suite) {
			//console.log(`[ETP] Suite does not match (expected ${this.suite}, got ${suite}), skipping VPEOutputContribution`)
			return
		}

		const vpes = toArray(node.VPE)

		let myVpe: any = null

		for (const vpe of vpes) {
			const vpeName = vpe?.$?.Name || ''
			//console.log(`Found VPE Name: ${vpeName}`)
			if (vpeName == this.me) {
				//console.log(`[ETP] Found matching ME: ${this.me}`)
				myVpe = vpe
				break
			}
		}

		if (!myVpe) {
			//console.log(`[ETP] No VPE node matching selected ME (${this.me}), skipping VPEOutputContribution`)
			return
		}

		console.log(`[ETP] Applying VPEOutputContribution for selected Suite/ME: ${this.suite} / ${this.me}`)
		this.lastVpeOutputContribution = node // Cache for later use by input handler

		const outputs = toArray(myVpe.Output)

		const addressPGM = new Set<string>()
		const addressPVW = new Set<string>()

		for (const out of outputs) {
			const outName = out?.$?.Name || ''
			const inputNames: string[] = toArray(out?.Input).map((i) => i || '')

			//console.log(`[ETP] Processing Output: ${outName} with inputs: ${inputNames.join(', ')}`)

			//console.log(this.engineeringSourceMap)

			if (outName === this.pgm_bus) {
				for (const inputName of inputNames) {
					const sourceId = this.vpeInputContributions.get(inputName)
					const engName = this.logicalSourceMap.get(sourceId)
					if (sourceId) {
						const engId = this.engineeringSourceMap.get(engName)
						if (engId) {
							console.log(`[ETP][PGM] ${inputName} → ${sourceId} (Engineering Name: ${engName} (${engId}))`)
							addressPGM.add(engId)
						}
					}
				}
			}

			if (outName === this.pvw_bus) {
				for (const inputName of inputNames) {
					const sourceId = this.vpeInputContributions.get(inputName)
					const engName = this.logicalSourceMap.get(sourceId)
					if (sourceId) {
						const engId = this.engineeringSourceMap.get(engName)
						if (engId) {
							console.log(`[ETP][PVW] ${inputName} → ${sourceId} (Engineering Name: ${engName} (${engId}))`)
							addressPVW.add(engId)
						}
					}
				}
			}
		}

		console.log('[ETP] Final Program sources:', Array.from(addressPGM))
		console.log('[ETP] Final Preview sources:', Array.from(addressPVW))

		const busIdPGM = '334e4eda'
		const busIdPVW = 'e393251c'

		for (const ds of device_sources) {
			if (ds.sourceId !== this.source.id) continue

			const addr = String(ds.address)
			const isPGM = addressPGM.has(addr)
			const isPVW = addressPVW.has(addr)

			if (isPGM) {
				this.addBusToAddress(addr, busIdPGM)
			} else {
				this.removeBusFromAddress(addr, busIdPGM)
			}

			if (isPVW) {
				this.addBusToAddress(addr, busIdPVW)
			} else {
				this.removeBusFromAddress(addr, busIdPVW)
			}
		}

		this.sendTallyData()
	}
}

/* ====================================================================== */
/*                                  Helpers                               */
/* ====================================================================== */

/** Normalize possibly-undefined value to an array */
function toArray<T = any>(x: any): T[] {
	if (!x) return []
	return Array.isArray(x) ? x : [x]
}

/** Strip control chars that commonly break xml2js without removing XML punctuation */
function safeAscii(s: string): string {
	return s.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
}

/**
 * Given an object like obj.ETP, return the first known key present.
 * This keeps dispatch logic predictable even if the device includes extra nodes or
 * staggered/inconsistent ordering.
 */
function pickKnownTag(etpObj: Record<string, any>, keys: string[]): string | null {
	for (const k of keys) {
		if (Object.prototype.hasOwnProperty.call(etpObj, k)) return k
	}
	return null
}
