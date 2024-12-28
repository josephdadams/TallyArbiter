import { currentConfig } from '../_helpers/config'
import { EventEmitter } from 'events'
import { BehaviorSubject } from 'rxjs'
import { logger } from '..'
import { Address } from '../_models/Address'
import { Source } from '../_models/Source'
import { AddressTallyData } from '../_models/TallyData'

const RECONNECT_INTERVAL = 5000 // in ms
const MAX_FAILED_RECONNECTS = 5

export class TallyInput extends EventEmitter {
	public connected = new BehaviorSubject<boolean>(false)
	public tally = new BehaviorSubject<AddressTallyData>({})
	private tallyData = {}
	public addresses = new BehaviorSubject<Address[]>([])
	protected source: Source
	private tryReconnecting = false
	private reconnectFailureCounter = 0
	reconnectTimeout: NodeJS.Timeout

	constructor(source: Source) {
		super()
		this.source = source
		logger(`Source: ${this.source.name} Creating connection.`, 'info-quiet')

		// Set max_reconnect to MAX_FAILED_RECONNECTS if not included in config.
		if (this.source.max_reconnects == undefined) {
			this.source.max_reconnects = MAX_FAILED_RECONNECTS
			logger(`Source: ${this.source.name} Set max reconnect.`, 'info-quiet')
		}

		// Log number of reconnect attempts
		if (this.source.max_reconnects == -1) {
			logger(`Source: ${this.source.name} Inifinite reconnect attempts.`, 'info-quiet')
		} else {
			logger(`Source: ${this.source.name} Reconnect attempts ${this.source.max_reconnects}.`, 'info-quiet')
		}

		// Log reconnect timeout
		// Configured timeout only used if larger then RECONNECT_INTERVAL
		if (this.source.reconnect_interval > RECONNECT_INTERVAL) {
			logger(
				`Source: ${this.source.name} Configured reconnect timeout: ${this.source.reconnect_interval}.`,
				'info-quiet',
			)
		} else {
			logger(`Source: ${this.source.name} Default reconnect timeout: ${RECONNECT_INTERVAL}.`, 'info-quiet')
		}

		this.connected.subscribe((connected) => {
			if (connected) {
				// Connected, no more reconnects for now
				logger(`Source: ${this.source.name} Connected.`, 'info-quiet')
				this.tryReconnecting = true
				this.reconnectFailureCounter = 0
			} else {
				if (!this.tryReconnecting) {
					// Connection attempt at startup
					logger(`Source: ${this.source.name} Connect triggered at startup.`, 'info-quiet')
					this.tryReconnecting = true
					return
				}

				// Reconnect if number of reconnects less than max number of reconnects or
				// if infinite reconnects are configured (-1)
				if (
					(this.tryReconnecting && this.source.max_reconnects == -1) ||
					this.reconnectFailureCounter < this.source.max_reconnects
				) {
					if (this.reconnectTimeout) {
						logger(`Source: ${this.source.name} Reconnect timeout not set.`, 'info-quiet')
						return
					}
					this.reconnectFailureCounter++
					logger(`Source: ${this.source.name} Reconnect attempt: ${this.reconnectFailureCounter}.`, 'info-quiet')

					// Use configured timeout only if larger then RECONNECT_INTERVAL
					if (this.source.reconnect_interval > RECONNECT_INTERVAL) {
						this.reconnectTimeout = setTimeout(() => {
							this.reconnectTimeout = undefined
							this.reconnect()
						}, this.source.reconnect_interval)
					} else {
						this.reconnectTimeout = setTimeout(() => {
							logger(`Source: ${this.source.name} Default timeout.`, 'info-quiet')
							this.reconnectTimeout = undefined
							this.reconnect()
						}, RECONNECT_INTERVAL)
					}
				} else {
					logger(`Source: ${this.source.name} No more reconnects.`, 'info-quiet')

					// Reset failure counter for future reconnect attempts.
					this.reconnectFailureCounter = 0
				}
			}
		})
	}

	public exit(): void {
		this.tryReconnecting = false
	}
	public reconnect(): void {}

	protected addAddress(label: string, address: string) {
		this.addresses.next(this.addresses.value.concat({ label, address }))
	}

	protected removeAddress(address: string) {
		this.addresses.next(this.addresses.value.filter((a) => a.address !== address))
	}

	protected renameAddress(address: string, newAddress: string, newLabel: string) {
		this.emit('renameAddress', address, newAddress) //this is for source types where the address is used as a key and is not a fixed number, like OBS

		//first check to see if the address current label is the same as the new label
		//if it is, don't update the label
		let addressObj = this.addresses.value.find((a) => a.address === address)
		if (addressObj) {
			if (addressObj.label !== newLabel) {
				this.addresses.next(
					this.addresses.value.filter((a) => a.address !== address).concat({ address: newAddress, label: newLabel }),
				)
			}
		} else {
			this.addresses.next(this.addresses.value.concat({ address: newAddress, label: newLabel }))
		}

		//now sort the addresses by address
		//first, let's see if the addresses are a number, or a string. If it returns NaN, it's a string, and we can sort alphabetically. If it's a number, we can sort numerically.
		this.addresses.value.sort((a, b) => {
			if (isNaN(parseInt(a.address))) {
				return a.address.localeCompare(b.address)
			} else {
				return parseInt(a.address) - parseInt(b.address)
			}
		})
	}

	protected addBusToAddress(address: string, bus: string) {
		//replace bus with its real id if it is "preview" or "program" or "aux"
		if (bus === 'preview') {
			bus = currentConfig.bus_options.find((b) => b.type === 'preview').id
		} else if (bus === 'program') {
			bus = currentConfig.bus_options.find((b) => b.type === 'program').id
		} else if (bus === 'aux') {
			bus = currentConfig.bus_options.find((b) => b.type === 'aux').id
		}

		if (!Array.isArray(this.tallyData[address])) {
			this.tallyData[address] = []
		}
		if (!this.tallyData[address].includes(bus)) {
			this.tallyData[address].push(bus)
		}
	}

	protected removeBusFromAddress(address: string, bus: string) {
		//replace bus with its real id if it is "preview" or "program" or "aux"
		if (bus === 'preview') {
			bus = currentConfig.bus_options.find((b) => b.type === 'preview').id
		} else if (bus === 'program') {
			bus = currentConfig.bus_options.find((b) => b.type === 'program').id
		} else if (bus === 'aux') {
			bus = currentConfig.bus_options.find((b) => b.type === 'aux').id
		}

		if (!Array.isArray(this.tallyData[address])) {
			this.tallyData[address] = []
		} else {
			this.tallyData[address] = this.tallyData[address].filter((b) => b !== bus)
		}
	}

	protected removeBusFromAllAddresses(bus: string) {
		//replace bus with its real id if it is "preview" or "program" or "aux"
		if (bus === 'preview') {
			bus = currentConfig.bus_options.find((b) => b.type === 'preview').id
		} else if (bus === 'program') {
			bus = currentConfig.bus_options.find((b) => b.type === 'program').id
		} else if (bus === 'aux') {
			bus = currentConfig.bus_options.find((b) => b.type === 'aux').id
		}

		for (const address of Object.keys(this.tallyData)) {
			this.tallyData[address] = this.tallyData[address].filter((b) => b !== bus)
		}
	}

	protected setBussesForAddress(address: string, busses: string[]) {
		//if bus is "preview" or "program", find its real bus id and use that instead because many source types use those words instead of the actual busId
		let realBusses = []
		for (let bus of busses) {
			if (bus === 'preview') {
				realBusses.push(currentConfig.bus_options.find((b) => b.type === 'preview').id)
			} else if (bus === 'program') {
				realBusses.push(currentConfig.bus_options.find((b) => b.type === 'program').id)
			} else if (bus === 'aux') {
				realBusses.push(currentConfig.bus_options.find((b) => b.type === 'aux').id)
			} else {
				realBusses.push(bus)
			}
		}

		this.tallyData[address] = realBusses || []
	}

	protected clearTallies() {
		for (let i = 0; i < this.addresses.value.length; i++) {
			let currentAddress = this.addresses.value[i].address
			this.setBussesForAddress(currentAddress, [])
			this.sendTallyData()
		}
	}

	protected sendTallyData() {
		this.tally.next(this.tallyData)
	}

	protected sendIndividualTallyData(address: string, busses: string[]) {
		//if bus is "preview" or "program", find its real bus id and use that instead because many source types use those words instead of the actual busId
		let realBusses = []
		for (let bus of busses) {
			if (bus === 'preview') {
				realBusses.push(currentConfig.bus_options.find((b) => b.type === 'preview').id)
			} else if (bus === 'program') {
				realBusses.push(currentConfig.bus_options.find((b) => b.type === 'program').id)
			} else if (bus === 'aux') {
				realBusses.push(currentConfig.bus_options.find((b) => b.type === 'aux').id)
			} else {
				realBusses.push(bus)
			}
		}

		let individualTallyData = {}
		individualTallyData[address] = realBusses || []
		this.tally.next(individualTallyData)
	}
}
