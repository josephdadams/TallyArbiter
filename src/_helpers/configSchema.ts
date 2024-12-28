export default {
	title: 'TallyArbiter config',
	description: 'Config used by the program TallyArbiter',
	type: 'object',
	properties: {
		security: {
			description: 'Security configuration',
			type: 'object',
			properties: {
				jwt_private_key: {
					description: 'JWT Private Key',
					type: 'string',
				},
			},
			required: ['jwt_private_key'],
		},
		users: {
			description: 'Users configuration',
			type: 'array',
			items: {
				type: 'object',
				properties: {
					username: {
						description: 'Username',
						type: 'string',
						default: 'admin',
					},
					password: {
						description: 'User password',
						type: 'string',
						default: '12345',
					},
					roles: {
						description: 'Comma-separated user roles',
						type: 'string',
						default: 'producer,settings:sources_devices,settings:testing',
					},
				},
				required: ['username', 'password', 'roles'],
			},
			minItems: 1,
			uniqueItems: true,
		},
		cloud_destinations: {
			description: 'List of cloud destinations',
			type: 'array',
			items: {
				type: 'object',
				properties: {
					host: {
						description: 'Host of the cloud destination',
						type: 'string',
					},
					port: {
						description: 'Port of the cloud destination',
						type: 'number',
					},
					key: {
						description: 'Key of the cloud destination',
						type: 'string',
					},
					id: {
						description: 'Id of the cloud destination',
						type: 'string',
					},
					status: {
						description: 'Status of the cloud destination',
						type: 'string',
					},
				},
				required: ['host', 'port', 'key', 'id', 'status'],
			},
			uniqueItems: true,
		},
		cloud_keys: {
			description: 'List of cloud keys',
			type: 'array',
			items: {
				type: 'string',
			},
			uniqueItems: true,
		},
		device_actions: {
			description: 'List of device actions',
			type: 'array',
			items: {
				type: 'object',
				properties: {
					deviceId: {
						description: 'Id of the device',
						type: 'string',
					},
					data: {
						description: 'Data of the device',
						type: 'object',
					},
					busId: {
						description: 'Id of the bus',
						type: 'string',
					},
					active: {
						description: 'Is the device action active',
						type: 'boolean',
					},
					outputTypeIdx: {
						description: 'Index of the output type',
						type: 'string',
					},
					outputTypeId: {
						description: 'Id of the output type',
						type: 'string',
					},
					id: {
						description: 'Id of the device action',
						type: 'string',
					},
				},
				required: ['deviceId', 'busId', 'active', 'outputTypeIdx', 'outputTypeId', 'id'],
			},
			uniqueItems: true,
		},
		device_sources: {
			description: 'List of device sources',
			type: 'array',
			items: {
				type: 'object',
				properties: {
					deviceId: {
						description: 'Device id',
						type: 'string',
					},
					address: {
						description: 'Device address',
						type: 'string',
					},
					id: {
						description: 'Device id',
						type: 'string',
					},
					sourceId: {
						description: 'Source id',
						type: 'string',
					},
					bus: {
						description: 'Linked busses',
						type: 'string',
					},
					rename: {
						description: 'Enables renaming',
						type: 'boolean',
					},
					reconnect_interval: {
						description: 'Configure reconnect interval',
						type: 'number',
					},
					max_reconnects: {
						description: 'Configured number of reconnects',
						type: 'number',
					},
				},
				required: ['deviceId', 'address', 'id', 'sourceId', 'bus', 'rename', 'reconnect_interval', 'max_reconnects'],
			},
			uniqueItems: true,
		},
		devices: {
			description: 'List of devices',
			type: 'array',
			items: {
				type: 'object',
				properties: {
					name: {
						description: 'Device name',
						type: 'string',
					},
					enabled: {
						description: 'Device enabled',
						type: 'boolean',
					},
					id: {
						description: 'ID of the device',
						type: 'string',
					},
				},
				required: ['name', 'enabled', 'id'],
			},
			uniqueItems: true,
		},
		sources: {
			description: 'List of sources',
			type: 'array',
			items: {
				type: 'object',
				properties: {
					id: {
						description: 'ID of the source',
						type: 'string',
					},
					name: {
						description: 'Name of the source',
						type: 'string',
					},
					sourceTypeId: {
						description: 'ID of the source type',
						type: 'string',
					},
					enabled: {
						description: 'Source enabled',
						type: 'boolean',
					},
					reconnect: {
						description: 'Source reconnect',
						type: 'boolean',
					},
					connected: {
						description: 'Source connected',
						type: 'boolean',
					},
					data: {
						description: 'Source data',
						type: 'object',
					},
				},
				required: ['id', 'name', 'sourceTypeId', 'enabled', 'reconnect', 'connected'],
			},
			uniqueItems: true,
		},
		tsl_clients: {
			description: 'List of TSL clients',
			type: 'array',
			items: {
				type: 'object',
				properties: {
					ip: {
						description: 'IP address of the TSL client',
						type: 'string',
					},
					port: {
						description: 'Port of the TSL client',
						type: 'integer',
					},
					transport: {
						description: 'Transport protocol of the TSL client',
						type: 'string',
					},
					id: {
						description: 'ID of the TSL client',
						type: 'string',
					},
				},
				required: ['ip', 'port', 'transport', 'id'],
			},
			uniqueItems: true,
		},
		tsl_clients_1secupdate: {
			description: 'Enable the TSL Clients 1secupdate option',
			type: 'boolean',
		},
		bus_options: {
			description: 'List of bus options',
			type: 'array',
			items: {
				type: 'object',
				properties: {
					id: {
						description: 'Bus id',
						type: 'string',
					},
					label: {
						description: 'Bus label',
						type: 'string',
					},
					type: {
						description: 'Bus type',
						type: 'string',
					},
					color: {
						description: 'Bus color',
						type: 'string',
					},
					priority: {
						description: 'Bus priority',
						type: 'number',
					},
				},
				required: ['id', 'label', 'type', 'color', 'priority'],
			},
			minItems: 1,
			uniqueItems: true,
		},
		externalAddress: {
			description: 'External address of the TallyArbiter instance',
			type: 'string',
		},
		uuid: {
			description: 'Unique code used to indentify every TallyArbiter instance',
			type: 'string',
		},
	},
	required: [
		'security',
		'cloud_destinations',
		'cloud_keys',
		'device_actions',
		'device_sources',
		'devices',
		'sources',
		'tsl_clients',
		'tsl_clients_1secupdate',
		'bus_options',
		'externalAddress',
		'uuid',
	],
}
