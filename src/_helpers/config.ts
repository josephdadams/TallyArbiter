import { logger, tslListenerProvider } from "..";
import { Config } from "../_models/Config";
import { ConfigTSLClient } from "../_models/ConfigTSLClient";
import fs from "fs";
import path from "path";
import { clone } from "./clone";
import { uuidv4 } from "./uuid";

function getConfigFilePath(): string {
	const configFolder = path.join(process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share"), "TallyArbiter");
	if (!fs.existsSync(configFolder)) {
		fs.mkdirSync(configFolder, { recursive: true });
	}
	const configName = "config.json";
	return path.join(configFolder, configName);
}

const config_file = getConfigFilePath();

export const ConfigDefaults: Config = {
    security: {
        username_producer: 'producer',
        password_producer: '12345',
        username_settings: 'admin',
        password_settings: '12345',
    },
    cloud_destinations: [],
    cloud_keys: [],
    device_actions: [],
    device_sources: [],
    devices: [],
    sources: [],
    tsl_clients: [],
    tsl_clients_1secupdate: false,
    bus_options: [
        { id: 'e393251c', label: 'Preview', type: 'preview', color: '#3fe481', priority: 50},
        { id: '334e4eda', label: 'Program', type: 'program', color: '#e43f5a', priority: 200},
        { id: '12c8d699', label: 'Aux 1', type: 'aux', color: '#0000FF', priority: 100},
        { id: '12c8d689', label: 'Aux 2', type: 'aux', color: '#0000FF', priority: 100}
    ],
    externalAddress: "http://0.0.0.0:4455/#/tally",
	remoteErrorReporting: false,
	uuid: uuidv4()
}

export let currentConfig: Config = clone(ConfigDefaults);

export function SaveConfig() {
	try {
		let tsl_clients_clean: ConfigTSLClient[] = [];

		if(tslListenerProvider !== undefined) {
			for (let i = 0; i < tslListenerProvider.tsl_clients.length; i++) {
				let tslClientObj: ConfigTSLClient = {} as ConfigTSLClient;
				tslClientObj.id = tslListenerProvider.tsl_clients[i].id;
				tslClientObj.ip = tslListenerProvider.tsl_clients[i].ip;
				tslClientObj.port = tslListenerProvider.tsl_clients[i].port;
				tslClientObj.transport = tslListenerProvider.tsl_clients[i].transport;
				tsl_clients_clean.push(tslClientObj);
			}
		}

		let configJson: Config = {
			...currentConfig,
			tsl_clients: tsl_clients_clean,
		};

		fs.writeFileSync(config_file, JSON.stringify(configJson, null, 1), 'utf8');

		logger('Config file saved to disk.', 'info-quiet');
	}
	catch (error) {
		logger(`Error saving configuration to file: ${error}`, 'error');
	}
}

export function readConfig(): void {
	let loadedConfig = JSON.parse(fs.readFileSync(config_file).toString());
    currentConfig = {
        ...clone(ConfigDefaults),
        ...loadedConfig,
    };
	if(!loadedConfig.uuid) {
		logger('Adding an uuid identifier to this server for using MDNS.', 'info-quiet');
		SaveConfig(); //uuid added if missing on config save
	}
}

export function getConfigRedacted(): Config {
	let config: Config = {} as Config;
	try {
		config = JSON.parse(fs.readFileSync(config_file).toString());
	} catch (e) {
	}
	config["security"] = {
		username_settings: "admin",
		password_settings: "12345",
		username_producer: "producer",
		password_producer: "12345"
	};
	config["cloud_destinations"] = [];
	config["cloud_keys"] = [];
	config["uuid"] = "uuid";
	return config;
}

export function replaceConfig(config: Config): void {
	logger('Replacing configuration.', 'info-quiet');
	fs.copyFileSync(config_file, config_file + '.bak');
	currentConfig = config;
	SaveConfig();
}

export function rollbackConfig(): void {
	fs.copyFileSync(config_file + '.bak', config_file);
	readConfig();
}
