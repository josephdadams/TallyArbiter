import Ajv from 'ajv'
import { Config } from '../_models/Config'
import { default as configSchema } from './configSchema'

export function validateConfig(config: object): Promise<Config | any> {
	return new Promise((resolve, reject) => {
		const ajv = new Ajv()
		const validate = ajv.compile(configSchema)
		const valid = validate(config)
		if (valid) {
			resolve(config)
		} else {
			reject(validate.errors)
		}
	})
}
