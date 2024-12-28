import { RegisterTallyInput } from '../_decorators/RegisterTallyInput.decorator'
import { Source } from '../_models/Source'
import { TallyInput } from './_Source'

@RegisterTallyInput('sourceId', 'label', 'HELP', [])
export class EditMeSource extends TallyInput {
	private client: any
	constructor(source: Source) {
		super(source)
		this.connected.next(true)
	}

	public exit(): void {
		super.exit()
	}
}
