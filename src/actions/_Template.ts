import { logger } from '..'
import { RegisterAction } from '../_decorators/RegisterAction'
import { Action } from './_Action'

@RegisterAction('id', 'name', [])
export class EditMe extends Action {
	public run(): void {
		//
	}
}
