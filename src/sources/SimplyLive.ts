import { RegisterTallyInput } from '../_decorators/RegisterTallyInput.decorator'
import { FreePort, UsePort } from '../_decorators/UsesPort.decorator'
import { Source } from '../_models/Source'
import { TallyInputConfigField } from '../_types/TallyInputConfigField'
import { TallyInput } from './_Source'
import dgram from 'dgram'
import { TSL5DataParser } from './TSL'

const SimplyLiveFields: TallyInputConfigField[] = [{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' }]

@RegisterTallyInput('4bbae5b31', 'SimplyLive', '', SimplyLiveFields)
export class SimplyLivePSource extends TallyInput {
	private server: any

	constructor(source: Source) {
		super(source)
		let port = source.data.port

		UsePort(port, this.source.id)
		this.server = dgram.createSocket('udp4')
		this.server.bind(port)

		this.server.on('message', (message) => {
			if (message.length >= 12) {
				let tallyobj: any = TSL5DataParser.parseTSL5Data(message)

				if (tallyobj.TEXT !== '') {
					this.renameAddress(
						tallyobj.INDEX[0].toString(),
						tallyobj.INDEX[0].toString(),
						tallyobj.TEXT.toString().trim(),
					)
				}

				let inPreview: number = 0
				let inProgram: number = 0

				if (tallyobj.control.rh_tally !== 0) {
					inPreview = 1
				}
				if (tallyobj.control.lh_tally !== 0) {
					inProgram = 1
				}

				const busses: string[] = []
				if (inPreview) {
					busses.push('preview')
				}
				if (inProgram) {
					busses.push('program')
				}

				this.setBussesForAddress(tallyobj.INDEX[0].toString(), busses)
				this.sendIndividualTallyData(tallyobj.INDEX[0].toString(), busses)
			}
		})

		this.connected.next(true)
	}

	public exit(): void {
		super.exit()
		this.server.close()
		FreePort(this.source.data.port, this.source.id)
		this.connected.next(false)
	}
}
