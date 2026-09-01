import { Component, OnDestroy, ChangeDetectionStrategy, ViewChild, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { JsonEditorComponent, JsonEditorOptions } from 'ang-jsoneditor'
import Swal from 'sweetalert2'
import { Confirmable } from 'src/app/_decorators/confirmable.decorator'
import { BusOption } from 'src/app/_models/BusOption'
import { default as configSchema } from 'src/app/_schemas/configSchema'
import { SocketService } from 'src/app/_services/socket.service'
import { BusOptionModalComponent } from '../../modals/bus-option-modal/bus-option-modal.component'

const globalSwalOptions = {
	confirmButtonColor: '#2a70c7',
}

/**
 * Raw config editor. Its own route so that jsoneditor — by a wide margin the
 * heaviest dependency in the app — is only fetched when an admin opens this tab.
 */
@Component({
	selector: 'app-config-tab',
	standalone: true,
	imports: [FormsModule, JsonEditorComponent],
	templateUrl: './config-tab.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrls: ['../../settings.component.scss'],
})
export class ConfigTabComponent implements OnDestroy {
	private readonly modalService = inject(NgbModal)
	public readonly socketService = inject(SocketService)

	@ViewChild('configEditor', { static: false }) configEditor!: JsonEditorComponent

	public readonly configLoaded = signal(false)
	public readonly config = signal<any>({})
	public readonly configWarnings = signal<Array<{ path: string; message: string; fix: () => void }>>([])

	public updatedConfig = {}
	public updatedConfigValid = true
	public updatedRawConfig = ''
	public readonly jsonEditorOptions = new JsonEditorOptions()

	private handleConfigReceived = (config: any) => {
		this.config.set(config)
		this.updatedConfig = config
		this.updatedRawConfig = JSON.stringify(config, null, 2)
		this.configLoaded.set(true)
		// validation needs the editor to exist, which it doesn't yet on first paint
		setTimeout(() => this.checkConfigWarnings(config, this.readEditorErrors()), 100)
	}

	constructor() {
		this.jsonEditorOptions.schema = configSchema
		this.socketService.socket.on('config', this.handleConfigReceived)
		this.socketService.socket.emit('get_config')
	}

	public ngOnDestroy() {
		this.socketService.socket.off('config', this.handleConfigReceived)
	}

	public addBusOption() {
		const ref = this.modalService.open(BusOptionModalComponent)
		ref.componentInstance.busOption = {} as BusOption
		ref.componentInstance.editing = false
	}

	public editBusOption(bus: BusOption) {
		const ref = this.modalService.open(BusOptionModalComponent)
		ref.componentInstance.busOption = { ...bus } as BusOption
		ref.componentInstance.editing = true
	}

	@Confirmable('Are you sure you want to delete this Bus Option?')
	public deleteBusOption(busOption: BusOption) {
		this.socketService.socket.emit('manage', {
			action: 'delete',
			type: 'bus_option',
			busOptionId: busOption.id,
		})
	}

	//jsoneditor validates with Ajv internally but exposes the errors differently
	//depending on version, hence the three fallbacks
	private readEditorErrors(): any[] {
		try {
			const editorJson = this.configEditor?.getEditor()
			if (!editorJson) return []

			editorJson.validate()
			if (editorJson.validateSchema && editorJson.validateSchema.errors) {
				return editorJson.validateSchema.errors || []
			}
			if (editorJson.validator && editorJson.validator.errors) {
				return editorJson.validator.errors || []
			}
			if ((editorJson as any).ajv && (editorJson as any).ajv.errors) {
				return (editorJson as any).ajv.errors || []
			}
		} catch (e) {
			console.error('Error accessing validation errors:', e)
		}
		return []
	}

	public configUpdated(event: any) {
		this.updatedConfig = event
		this.updatedRawConfig = JSON.stringify(event, null, 2)

		const errors = this.readEditorErrors()
		this.updatedConfigValid = errors.length === 0
		this.checkConfigWarnings(event, errors)
	}

	private checkConfigWarnings(config: any, schemaErrors: any[] = []) {
		const warnings: Array<{ path: string; message: string; fix: () => void }> = []

		// Check for missing top-level properties
		const defaults = this.getConfigDefaults()
		this.findMissingProperties(config, defaults, '', warnings)

		// Check for missing required properties from schema validation errors
		if (schemaErrors && schemaErrors.length > 0) {
			this.parseSchemaValidationErrors(schemaErrors, config, warnings)
		}

		this.configWarnings.set(warnings)
	}

	private getConfigDefaults(): any {
		// These should match ConfigDefaults from src/_helpers/config.ts
		return {
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
			chat_enabled: true,
			remoteErrorReporting: false,
			uuid: '',
			mqtt: {
				enabled: false,
				broker: 'localhost',
				port: 1883,
				username: '',
				password: '',
				topicPrefix: 'tallyarbiter',
				retain: true,
				qos: 0,
			},
		}
	}

	private findMissingProperties(
		config: any,
		defaults: any,
		path: string,
		warnings: Array<{ path: string; message: string; fix: () => void }>,
	) {
		for (const [key, defaultValue] of Object.entries(defaults)) {
			const currentPath = path ? `${path}.${key}` : key

			// Check if property exists in config
			if (config[key] === undefined) {
				// Property is missing
				if (Array.isArray(defaultValue)) {
					warnings.push({
						path: currentPath,
						message: `Property "${currentPath}" is missing. Default value: empty array []`,
						fix: () => {
							this.applyPropertyDefault(currentPath, defaultValue)
						},
					})
				} else if (defaultValue !== null && typeof defaultValue === 'object' && !Array.isArray(defaultValue)) {
					// It's an object - warn about missing object
					warnings.push({
						path: currentPath,
						message: `Property "${currentPath}" is missing. This will be added with default values.`,
						fix: () => {
							this.applyPropertyDefault(currentPath, defaultValue)
						},
					})
				} else {
					// Primitive value
					const displayValue =
						typeof defaultValue === 'string' && defaultValue.length > 50
							? defaultValue.substring(0, 50) + '...'
							: JSON.stringify(defaultValue)
					warnings.push({
						path: currentPath,
						message: `Property "${currentPath}" is missing. Default value: ${displayValue}`,
						fix: () => {
							this.applyPropertyDefault(currentPath, defaultValue)
						},
					})
				}
			} else if (
				defaultValue !== null &&
				typeof defaultValue === 'object' &&
				!Array.isArray(defaultValue) &&
				typeof config[key] === 'object' &&
				!Array.isArray(config[key])
			) {
				// Both are objects - recurse to check nested properties
				this.findMissingProperties(config[key], defaultValue, currentPath, warnings)
			}
			// If config[key] exists and is not an object, or if it's an array, we don't need to check further
		}
	}

	private parseSchemaValidationErrors(
		errors: any[],
		config: any,
		warnings: Array<{ path: string; message: string; fix: () => void }>,
	) {
		if (!errors || errors.length === 0) {
			return
		}

		const arrayItemDefaults = this.getArrayItemDefaults()

		for (const error of errors) {
			// Only handle "required" errors (missing required properties)
			if (error.keyword === 'required' && error.params && error.params.missingProperty) {
				const missingProperty = error.params.missingProperty
				// Try different path properties (AJV v6 vs v7+)
				const dataPath = error.dataPath || error.instancePath || error.path || ''

				// Parse the dataPath - format is ".device_sources[0]"
				// Remove leading dot and extract property name and index
				const cleanPath = dataPath.replace(/^\.+/, '')
				const match = cleanPath.match(/^([^[\]]+)\[(\d+)\]$/)

				if (!match) {
					console.warn(`Unexpected path format: ${dataPath}`)
					continue
				}

				const pathParts = [match[1], match[2]] // ["device_sources", "0"]
				const displayPath = `${match[1]}[${match[2]}].${missingProperty}`
				const defaultValue = this.getDefaultValueForProperty(pathParts, missingProperty, arrayItemDefaults)

				// Create fix function
				const fix = () => {
					this.applyPropertyDefaultFromPath(pathParts, missingProperty, defaultValue)
				}

				// Check if we already have a warning for this path
				const existingWarning = warnings.find((w) => w.path === displayPath)
				if (!existingWarning) {
					const displayValue =
						typeof defaultValue === 'string' && defaultValue.length > 50
							? defaultValue.substring(0, 50) + '...'
							: JSON.stringify(defaultValue)

					warnings.push({
						path: displayPath,
						message: `Missing required property "${missingProperty}". Default value: ${displayValue}`,
						fix: fix,
					})
				}
			}
		}
	}

	private getArrayItemDefaults(): any {
		// Default values for properties within array items
		return {
			device_sources: {
				reconnect_interval: 5000,
				max_reconnects: 5,
				rename: false,
				bus: '',
				address: '',
				deviceId: '',
				id: '',
				sourceId: '',
			},
			device_actions: {
				active: false,
			},
			devices: {},
			sources: {
				reconnect_interval: 5000,
				max_reconnects: 5,
			},
		}
	}

	private getDefaultValueForProperty(pathParts: string[], propertyName: string, arrayItemDefaults: any): any {
		// If this is an array item (pathParts has a numeric last part)
		if (pathParts.length >= 2) {
			const arrayName = pathParts[pathParts.length - 2]
			const itemDefaults = arrayItemDefaults[arrayName]
			if (itemDefaults && itemDefaults[propertyName] !== undefined) {
				return itemDefaults[propertyName]
			}
		}

		// Default based on property name patterns
		if (propertyName.includes('interval') || propertyName.includes('Interval')) {
			return 5000
		}
		if (propertyName.includes('reconnect') || propertyName.includes('Reconnect')) {
			return 5
		}
		if (
			propertyName.includes('enabled') ||
			propertyName.includes('Enabled') ||
			propertyName.includes('active') ||
			propertyName.includes('Active')
		) {
			return false
		}
		if (propertyName.includes('rename') || propertyName.includes('Rename')) {
			return false
		}
		if (propertyName.includes('id') || propertyName.includes('Id')) {
			return ''
		}
		// For string properties like "bus", "address", etc., return empty string
		if (propertyName === 'bus' || propertyName === 'address' || propertyName === 'name' || propertyName === 'label') {
			return ''
		}

		// Generic defaults - return empty string for unknown properties (safer than null)
		// This prevents type errors when the schema expects a string but gets null
		return ''
	}

	private applyPropertyDefaultFromPath(pathParts: string[], propertyName: string, defaultValue: any) {
		// Create a working copy to avoid mutating the original during navigation
		let target: any = this.updatedConfig

		console.log(`Applying fix: path=${pathParts.join('.')}, property=${propertyName}, value=${defaultValue}`)

		// Navigate to the target object
		for (let i = 0; i < pathParts.length; i++) {
			const part = pathParts[i]
			// Check if part is a numeric index (array)
			const index = parseInt(part, 10)
			const isNumericIndex = !isNaN(index) && part === index.toString()

			if (isNumericIndex) {
				// It's a numeric index - target should be an array
				if (!Array.isArray(target)) {
					console.warn(`Expected array at ${pathParts.slice(0, i).join('.')}, got ${typeof target}`)
					return
				}
				if (target[index] === undefined) {
					console.warn(`Array index ${index} does not exist in ${pathParts.slice(0, i).join('.')}`)
					return
				}
				target = target[index]
			} else {
				// It's a property name
				if (target[part] === undefined) {
					// Check if next part is a numeric index - if so, this should be an array
					if (i < pathParts.length - 1) {
						const nextPart = pathParts[i + 1]
						const nextIndex = parseInt(nextPart, 10)
						if (!isNaN(nextIndex) && nextPart === nextIndex.toString()) {
							// Next part is an array index, so this should be an array
							target[part] = []
						} else {
							target[part] = {}
						}
					} else {
						// This is the final part, but we're setting a property on it, so it should be an object
						// This shouldn't happen for array item fixes, but handle it anyway
						target[part] = {}
					}
				} else if (!Array.isArray(target[part]) && typeof target[part] !== 'object') {
					// If it's not an object or array, we can't navigate further
					console.warn(`Cannot navigate to property ${part} in path ${pathParts.join('.')} - not an object`)
					return
				}
				target = target[part]
			}
		}

		// Set the property value on the array item object
		target[propertyName] = defaultValue

		// Create a deep copy to ensure Angular detects the change
		const newConfig = JSON.parse(JSON.stringify(this.updatedConfig))
		this.updatedConfig = newConfig
		this.config.set(newConfig)
		this.updatedRawConfig = JSON.stringify(newConfig, null, 2)

		// Revalidate after editor updates
		setTimeout(() => {
			this.configUpdated(newConfig)
		}, 200)
	}

	private applyPropertyDefault(path: string, defaultValue: any) {
		const pathParts = path.split('.')
		let target: any = this.updatedConfig

		// Navigate to the parent object
		for (let i = 0; i < pathParts.length - 1; i++) {
			const part = pathParts[i]
			if (!target[part] || typeof target[part] !== 'object') {
				target[part] = {}
			}
			target = target[part]
		}

		// Set the value
		const finalKey = pathParts[pathParts.length - 1]

		// If it's an object, merge with existing values
		if (defaultValue !== null && typeof defaultValue === 'object' && !Array.isArray(defaultValue)) {
			target[finalKey] = {
				...defaultValue,
				...(target[finalKey] || {}),
			}
		} else {
			target[finalKey] = defaultValue
		}

		// Create a deep copy to ensure we have a fresh object reference
		const newConfig = JSON.parse(JSON.stringify(this.updatedConfig))

		// Update all config references with the new deep copy
		this.updatedConfig = newConfig
		// bound to [data] in the template, so updating it updates the editor
		this.config.set(newConfig)
		this.updatedRawConfig = JSON.stringify(newConfig, null, 2)

		// Trigger validation and recheck warnings after Angular updates the editor
		setTimeout(() => {
			this.configUpdated(newConfig)
		}, 200)
	}

	public fixConfigWarning(warning: { path: string; message: string; fix: () => void }) {
		warning.fix()
		Swal.fire({
			title: 'Fixed!',
			text: `Applied default value for ${warning.path}`,
			icon: 'success',
			timer: 2000,
			showConfirmButton: false,
			...globalSwalOptions,
		})
	}

	public fixAllConfigWarnings() {
		if (this.configWarnings().length === 0) {
			return
		}

		// Collect all changes that will be applied
		const changes: Array<{ path: string; value: string }> = []
		for (const warning of this.configWarnings()) {
			// Extract the value from the warning message
			const valueMatch = warning.message.match(/Default value: (.+)$/)
			const displayValue = valueMatch ? valueMatch[1] : 'default'
			changes.push({
				path: warning.path,
				value: displayValue,
			})
		}

		// Apply all fixes by directly modifying the config
		// This is more efficient than calling each fix() individually
		const config: any = this.updatedConfig
		for (const warning of this.configWarnings()) {
			// Extract path parts from warning path (e.g., "device_sources[0].bus" -> ["device_sources", "0", "bus"])
			const pathMatch = warning.path.match(/^([^[\]]+)\[(\d+)\]\.(.+)$/)
			if (pathMatch) {
				const arrayName = pathMatch[1]
				const index = parseInt(pathMatch[2], 10)
				const propertyName = pathMatch[3]

				// Get the default value
				const arrayItemDefaults = this.getArrayItemDefaults()
				const defaultValue = this.getDefaultValueForProperty(
					[arrayName, index.toString()],
					propertyName,
					arrayItemDefaults,
				)

				// Apply the fix directly
				if (config[arrayName] && Array.isArray(config[arrayName]) && config[arrayName][index]) {
					config[arrayName][index][propertyName] = defaultValue
				}
			} else {
				// For non-array paths, use the existing fix function
				warning.fix()
			}
		}

		// Create a deep copy and update all references
		const newConfig = JSON.parse(JSON.stringify(this.updatedConfig))
		this.updatedConfig = newConfig
		this.config.set(newConfig)
		this.updatedRawConfig = JSON.stringify(newConfig, null, 2)

		// Revalidate after all fixes are applied
		setTimeout(() => {
			this.configUpdated(newConfig)

			// Show summary of changes
			let summaryHtml = `<div style="text-align: left;"><p><strong>Applied ${changes.length} fixes:</strong></p><ul style="margin-top: 10px; max-height: 400px; overflow-y: auto;">`
			for (const change of changes) {
				summaryHtml += `<li style="margin-bottom: 5px;"><strong>${change.path}</strong>: <code>${change.value}</code></li>`
			}
			summaryHtml += '</ul></div>'

			Swal.fire({
				title: 'All Fixed!',
				html: summaryHtml,
				icon: 'success',
				confirmButtonText: 'OK',
				width: '600px',
				...globalSwalOptions,
			})
		}, 300)
	}

	@Confirmable('Are you sure you want to update your config? Be careful and continue only if you are absolutely sure.')
	public saveConfig() {
		console.log(this.updatedConfig)
		this.config.set(this.updatedConfig)
		this.socketService.socket.once('error', (message: string) => {
			alert(message)
		})
		this.socketService.socket.emit('set_config', this.config())
	}

	@Confirmable('Are you sure you want to update your config? Be careful and continue only if you are absolutely sure.')
	public saveRawConfig() {
		console.log(this.updatedRawConfig)
		this.config.set(JSON.parse(this.updatedRawConfig))
		this.socketService.socket.once('error', (message: string) => {
			alert(message)
		})
		this.socketService.socket.emit('set_config', this.config())
	}

	public exportConfig() {
		const blob = new Blob([JSON.stringify(this.config(), null, 2)], { type: 'application/json' })
		const url = window.URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = 'config.json'
		a.click()
	}

	public importConfig() {
		try {
			const input = document.createElement('input')
			input.type = 'file'
			input.onchange = () => {
				const reader = new FileReader()
				reader.onload = (e) => {
					if (!e?.target?.result) return

					const imported = JSON.parse(e.target.result as string)
					this.config.set(imported)
					this.updatedConfig = imported
					this.updatedRawConfig = JSON.stringify(imported, null, 2)
					this.configEditor?.set(imported as any)

					setTimeout(() => {
						const errors = this.readEditorErrors()
						this.updatedConfigValid = errors.length === 0
						this.checkConfigWarnings(imported, errors)
					}, 100)

					this.socketService.socket.emit('set_config', imported)
				}
				reader.readAsText((input.files as FileList)[0])
			}
			input.click()
		} catch (e) {
			console.error('Error importing config:', e)
		}
	}
}
