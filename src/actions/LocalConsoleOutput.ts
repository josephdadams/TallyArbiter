import axios from 'axios'
import { logger } from '..'
import { RegisterAction } from '../_decorators/RegisterAction'
import { Action } from './_Action'

@RegisterAction('6dbb7bf7', 'Local Console Output', [{ fieldName: 'text', fieldLabel: 'Text', fieldType: 'text' }])
export class ConsoleOutput extends Action {
	public run(): void {
		logger(this.action.data.text, 'console_action')
	}
}
