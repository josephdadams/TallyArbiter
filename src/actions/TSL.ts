import { logger } from '..'
import { RegisterAction } from '../_decorators/RegisterAction'
import { TallyInputConfigField } from '../_types/TallyInputConfigField'
import { Action } from './_Action'
import dgram from 'dgram'
import net from 'net'
import TSLUMDv5 from 'tsl-umd-v5'

const TSL3Fields: TallyInputConfigField[] = [
	{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
	{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
	{ fieldName: 'address', fieldLabel: 'Address', fieldType: 'number' },
	{ fieldName: 'label', fieldLabel: 'Label', fieldType: 'text' },
	{ fieldName: 'tally1', fieldLabel: 'Tally 1', fieldType: 'bool' },
	{ fieldName: 'tally2', fieldLabel: 'Tally 2', fieldType: 'bool' },
	{ fieldName: 'tally3', fieldLabel: 'Tally 3', fieldType: 'bool' },
	{ fieldName: 'tally4', fieldLabel: 'Tally 4', fieldType: 'bool' },
]
const TSL5Fields: TallyInputConfigField[] = [
	{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
	{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
	{ fieldName: 'index', fieldLabel: 'Address Index', fieldType: 'number' },
	{ fieldName: 'screen', fieldLabel: 'Screen', fieldType: 'number' },
	{ fieldName: 'text', fieldLabel: 'Label', fieldType: 'text' },
	{
		fieldName: 'text_tally',
		fieldLabel: 'Text Tally',
		fieldType: 'dropdown',
		options: [
			{ id: '0', label: 'Off' },
			{ id: '1', label: 'Red' },
			{ id: '2', label: 'Green' },
			{ id: '3', label: 'Amber' },
		],
	},
	{
		fieldName: 'rh_tally',
		fieldLabel: 'Right Tally',
		fieldType: 'dropdown',
		options: [
			{ id: '0', label: 'Off' },
			{ id: '1', label: 'Red' },
			{ id: '2', label: 'Green' },
			{ id: '3', label: 'Amber' },
		],
	},
	{
		fieldName: 'lh_tally',
		fieldLabel: 'Left Tally',
		fieldType: 'dropdown',
		options: [
			{ id: '0', label: 'Off' },
			{ id: '1', label: 'Red' },
			{ id: '2', label: 'Green' },
			{ id: '3', label: 'Amber' },
		],
	},
	{
		fieldName: 'brightness',
		fieldLabel: 'Brightness',
		fieldType: 'dropdown',
		options: [
			{ id: '0', label: '0' },
			{ id: '1', label: '1' },
			{ id: '2', label: '2' },
			{ id: '3', label: '3' },
		],
	},
	{
		fieldName: 'sequence',
		fieldLabel: 'DLE/STX sequence',
		fieldType: 'dropdown',
		options: [
			{ id: 'default', label: 'Default' },
			{ id: 'ON', label: 'ON' },
			{ id: 'OFF', label: 'OFF' },
		],
	},
]

@RegisterAction('7dcd66b5', 'TSL 3.1 UDP', TSL3Fields)
@RegisterAction('276a8dcc', 'TSL 3.1 TCP', TSL3Fields)
@RegisterAction('8b99d588', 'TSL 5 UDP', TSL5Fields)
@RegisterAction('54ae4a7e', 'TSL 5 TCP', TSL5Fields)
export class TSL extends Action {
	public run(): void {
		if (['7dcd66b5', '276a8dcc'].includes(this.action.outputTypeId)) {
			// TSL 3.1
			try {
				let bufUMD = Buffer.alloc(18, 0) //ignores spec and pad with 0 for better aligning on Decimator etc
				bufUMD[0] = 0x80 + parseInt(this.action.data.address)
				bufUMD.write(this.action.data.label, 2)

				let bufTally = 0x30

				if (this.action.data.tally1) {
					bufTally |= 1
				}
				if (this.action.data.tally2) {
					bufTally |= 2
				}
				if (this.action.data.tally3) {
					bufTally |= 4
				}
				if (this.action.data.tally4) {
					bufTally |= 8
				}
				bufUMD[1] = bufTally

				if (this.action.outputTypeId == '7dcd66b5') {
					// UDP
					let client = dgram.createSocket('udp4')
					client.send(bufUMD, this.action.data.port, this.action.data.ip, function (error) {
						if (!error) {
							logger(`TSL 3.1 UDP Data sent.`, 'info')
						}
						client.close()
					})
				} else {
					// TCP
					let client = new net.Socket()
					client.connect(this.action.data.port, this.action.data.ip, () => {
						client.write(bufUMD)
					})

					client.on('data', () => {
						client.destroy() // kill client after server's response
					})

					client.on('close', () => {})
				}
			} catch (error) {
				logger(
					`An error occured sending the TCP 3.1 ${this.action.outputTypeId == '7dcd66b5' ? 'UDP' : 'TCP'} Message: ${error}`,
					'error',
				)
			}
		} else {
			// TSL 5
			try {
				var umd = new TSLUMDv5()
				var display_fields = ['rh_tally', 'text_tally', 'lh_tally', 'brightness', 'text']
				let tally: any = { display: {} }
				let sequence = null

				if (!(this.action.data.ip && this.action.data.port)) {
					logger(
						`Error in TSL 5 ${this.action.outputTypeId == '8b99d588' ? 'UDP' : 'TCP'} Action. IP and Port must be given`,
						'error',
					)
				}
				if (!this.action.data.index) {
					logger(
						`TSL 5 ${this.action.outputTypeId == '8b99d588' ? 'UDP' : 'TCP'} Action. No index given. Using index 1 by default`,
						'info',
					)
					tally.index = 1
				}

				if (this.action.data.sequence == 'ON') {
					sequence = true
				}
				if (this.action.data.sequnece == 'OFF') {
					sequence = false
				}

				for (var [key, value] of Object.entries(this.action.data)) {
					if (display_fields.includes(key)) {
						tally.display[key] = value
					} else {
						tally[key] = value
					}
				}

				if (this.action.outputTypeId == '8b99d588') {
					// UDP
					umd.sendTallyUDP(this.action.data.ip, this.action.data.port, tally, sequence)
				} else {
					// TCP
					umd.sendTallyTCP(this.action.data.ip, this.action.data.port, tally, sequence)
				}
				logger(`TSL 5 ${this.action.outputTypeId == '8b99d588' ? 'UDP' : 'TCP'} Data sent.`, 'info')
			} catch (error) {
				logger(
					`An error occured sending the TSL 5 ${this.action.outputTypeId == '8b99d588' ? 'UDP' : 'TCP'} Message: ${error}`,
					'error',
				)
			}
		}
	}
}
