import { logger, tslListenerProvider } from '..'
import { Config } from '../_models/Config'
import { ConfigTSLClient } from '../_models/ConfigTSLClient'
import fs from 'fs-extra'
import path from 'path'
import { randomBytes } from 'crypto'
import { clone } from './clone'
import { uuidv4 } from './uuid'
import { addUser } from './auth'

function getConfigFilePath(): string {
	const configFolder = path.join(
		process.env.APPDATA ||
			(process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share'),
		'TallyArbiter',
	)
	if (!fs.existsSync(configFolder)) {
		fs.mkdirSync(configFolder, { recursive: true })
	}
	const configName = 'config.json'
	return path.join(configFolder, configName)
}

const config_file = getConfigFilePath()

export const ConfigDefaults: Config = {
	security: {
		jwt_private_key: '',
	},
	users: [],
	cloud_destinations: [],
	cloud_keys: [],
	device_actions: [],
	device_sources: [],
	devices: [],
	sources: [],
	tsl_clients: [],
	tsl_clients_1secupdate: false,
	bus_options: [
		{ id: 'e393251c', label: 'Preview', type: 'preview', color: '#3fe481', priority: 50, visible: true },
		{ id: '334e4eda', label: 'Program', type: 'program', color: '#e43f5a', priority: 200, visible: true },
		{ id: '12c8d699', label: 'Aux 1', type: 'aux', color: '#0000FF', priority: 100, visible: true },
		{ id: '0449b0c7', label: 'Aux 2', type: 'aux', color: '#0000FF', priority: 100, visible: true },
		{ id: '5d94f273', label: 'Aux 3', type: 'aux', color: '#0000FF', priority: 100, visible: false },
		{ id: '77ffb605', label: 'Aux 4', type: 'aux', color: '#0000FF', priority: 100, visible: false },
		{ id: '09d4975d', label: 'Aux 5', type: 'aux', color: '#0000FF', priority: 100, visible: false },
		{ id: 'e2c2e192', label: 'Aux 6', type: 'aux', color: '#0000FF', priority: 100, visible: false },
		{ id: '734f7395', label: 'Aux 7', type: 'aux', color: '#0000FF', priority: 100, visible: false },
		{ id: '3011d34a', label: 'Aux 8', type: 'aux', color: '#0000FF', priority: 100, visible: false },
	],
	externalAddress: 'http://0.0.0.0:4455/#/tally',
	remoteErrorReporting: false,
	uuid: '',
}

export let currentConfig: Config = clone(ConfigDefaults)
export let isConfigLoaded: boolean = false

export function SaveConfig() {
	try {
		let tsl_clients_clean: ConfigTSLClient[] = []

		if (tslListenerProvider !== undefined) {
			for (let i = 0; i < tslListenerProvider.tsl_clients.length; i++) {
				let tslClientObj: ConfigTSLClient = {} as ConfigTSLClient
				tslClientObj.id = tslListenerProvider.tsl_clients[i].id
				tslClientObj.ip = tslListenerProvider.tsl_clients[i].ip
				tslClientObj.port = tslListenerProvider.tsl_clients[i].port
				tslClientObj.transport = tslListenerProvider.tsl_clients[i].transport
				tsl_clients_clean.push(tslClientObj)
			}
		}

		let configJson: Config = {
			...currentConfig,
			tsl_clients: tsl_clients_clean,
		}

		fs.writeFileSync(config_file, JSON.stringify(configJson, null, 1), 'utf8')

		logger('Config file saved to disk.', 'info-quiet')
	} catch (error) {
		logger(`Error saving configuration to file: ${error}`, 'error')
	}
}

export function readConfig(): void {
	isConfigLoaded = true
	const configPath = getConfigFilePath()
	if (!fs.pathExistsSync(configPath)) {
		try {
			SaveConfig()
		} catch (e) {}
	}
	let loadedConfig = JSON.parse(fs.readFileSync(configPath).toString())
	currentConfig = {
		...clone(ConfigDefaults),
		...loadedConfig,
	}
	if (!loadedConfig.uuid || typeof loadedConfig.uuid !== 'string') {
		logger('Adding an uuid identifier to this server for using MDNS.', 'info-quiet')
		currentConfig.uuid = uuidv4()
		SaveConfig() //uuid added if missing on config save
	}
	if (!loadedConfig.security.jwt_private_key || typeof loadedConfig.security.jwt_private_key !== 'string') {
		logger('Adding a private key for JWT authentication.', 'info-quiet')
		currentConfig.security.jwt_private_key = randomBytes(256).toString('base64')
		SaveConfig() //uuid added if missing on config save
	}
	if (!loadedConfig.users || typeof loadedConfig.users !== 'object' || loadedConfig.users.length === 0) {
		logger('Migrating user configs to the new format.', 'info-quiet')
		currentConfig.users = []
		addUser({
			username: loadedConfig.security.username_producer || 'producer',
			password: loadedConfig.security.password_producer || '12345',
			roles: 'producer',
		})
		addUser({
			username: loadedConfig.security.username_settings || 'admin',
			password: loadedConfig.security.password_settings || '12345',
			roles: 'admin',
		})
		delete currentConfig.security.username_producer
		delete currentConfig.security.password_producer
		delete currentConfig.security.username_settings
		delete currentConfig.security.password_settings
		SaveConfig()
	}
}

export function getConfigRedacted(): Config {
	let config: Config = {} as Config
	try {
		config = JSON.parse(fs.readFileSync(config_file).toString())
	} catch (e) {}
	config['security'] = {
		jwt_private_key: '',
	}
	config['users'] = []
	config['cloud_destinations'] = []
	config['cloud_keys'] = []
	config['uuid'] = ''
	return config
}

export function replaceConfig(config: Config): void {
	logger('Replacing configuration.', 'info-quiet')
	fs.copyFileSync(config_file, config_file + '.bak')
	currentConfig = config
	SaveConfig()
}

export function rollbackConfig(): void {
	fs.copyFileSync(config_file + '.bak', config_file)
	readConfig()
}
