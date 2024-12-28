import { currentConfig } from '../_helpers/config'
import { timeStamp } from 'console'
import { RegisterTallyInput } from '../_decorators/RegisterTallyInput.decorator'
import { Source } from '../_models/Source'
import { TallyInput } from './_Source'

@RegisterTallyInput('TESTMODE', 'Internal Test Mode', 'Used for Test Mode functionality.', [
	{
		fieldName: 'info',
		fieldLabel: 'Information',
		text: 'This source generates preview/program tally data for the purposes of testing equipment.',
		fieldType: 'info',
	},
	{
		fieldName: 'interval',
		fieldLabel: 'Bus change interval (in milliseconds (ms)) (default option: 1000).',
		fieldType: 'number',
		optional: true,
	},
	{
		fieldName: 'changeMode',
		fieldLabel: 'Bus change mode (default option: one device at a time).',
		fieldType: 'dropdown',
		optional: true,
		options: [
			{ id: 'one-at-a-time', label: 'One device at a time' },
			{ id: 'all-at-once', label: 'All devices at once' },
		],
	},
	{
		fieldName: 'addressesNumber',
		fieldLabel: 'Test addresses number (default option: 10).',
		optional: true,
		fieldType: 'number',
	},
])
export class InternalTestModeSource extends TallyInput {
	currentAddressNumber = 0
	currentAddressIterations = 0

	busses = currentConfig.bus_options.map((bus) => bus.id)

	testModeInterval: NodeJS.Timeout

	currentInterval: number

	constructor(source: Source) {
		super(source)

		if (!this.source.data.interval) this.source.data.interval = 100
		if (!this.source.data.changeMode) this.source.data.changeMode = 'one-at-a-time'
		if (!this.source.data.addressesNumber) this.source.data.addressesNumber = 10

		//console.log("addressesNumber", this.source.data.addressesNumber);

		for (let i = 0; i < this.source.data.addressesNumber; i++) {
			const address = this.getAddressForIdx(i)
			this.addAddress(address, address)
		}
		//Cut addresses list if there are more addresses than the number of addresses (for example if you change it to 5 and there are 10 addresses, removes the last 5 addresses)
		this.addresses.next(
			this.addresses.value.filter((a) => {
				let current_test_address_number = parseInt(a.address.replace('TEST_', ''))
				return current_test_address_number <= this.source.data.addressesNumber
			}),
		)
		this.sendTallyData()

		this.testModeInterval = setInterval(() => this.testModeIntervalFunction(), this.source.data.interval)

		this.currentInterval = this.source.data.interval

		this.connected.next(true)
	}

	private checkIntervalValue() {
		if (this.currentInterval != this.source.data.interval) {
			clearInterval(this.testModeInterval)
			this.testModeInterval = setInterval(() => this.testModeIntervalFunction(), this.source.data.interval)
		}
	}

	private testModeIntervalFunction() {
		this.currentAddressIterations++

		//console.log("currentAddressNumber", this.currentAddressNumber, "currentAddressIterations", this.currentAddressIterations, this.busses[this.currentAddressIterations - 1]);

		//console.log("busses", this.busses);

		this.busses.forEach((busses) => {
			this.removeBusFromAllAddresses(busses)
		})

		if (this.source.data.changeMode == 'one-at-a-time') {
			this.setBussesForAddressFromIterationsNumber(this.currentAddressNumber)
		} else if (this.source.data.changeMode == 'all-at-once') {
			for (let i = 0; i < this.source.data.addressesNumber; i++) {
				this.setBussesForAddressFromIterationsNumber(i)
			}
		}
		this.sendTallyData()

		if (this.currentAddressIterations >= this.busses.length) {
			if (this.source.data.changeMode == 'one-at-a-time') {
				if (this.currentAddressNumber < this.source.data.addressesNumber - 1) {
					this.currentAddressNumber++
				} else {
					this.currentAddressNumber = 0
				}
			}
			this.currentAddressIterations = 0
		}

		this.checkIntervalValue()
	}

	private setBussesForAddressFromIterationsNumber(addressNumber: number) {
		if (this.currentAddressIterations <= this.busses.length) {
			this.setBussesForAddress(this.getAddressForIdx(addressNumber), [this.busses[this.currentAddressIterations - 1]])
		}
	}

	public getAddressForIdx(idx: number): string {
		return `TEST_${idx}`
	}

	public exit(): void {
		super.exit()
		clearInterval(this.testModeInterval)
		this.clearTallies()
	}
}
