import mqtt, { MqttClient } from 'mqtt'
import { EventEmitter } from 'events'
import { logger } from '..'
import { currentConfig } from '../_helpers/config'
import { DeviceTallyData } from '../_models/TallyData'
import { DeviceState } from '../_models/DeviceState'
import { Device } from '../_models/Device'
import { devices } from '../index'

export interface MQTTConfig {
	enabled: boolean
	broker: string
	port: number
	username?: string
	password?: string
	topicPrefix: string
	retain: boolean
	qos: 0 | 1 | 2
}

export class MQTTService extends EventEmitter {
	private client: MqttClient | null = null
	private config: MQTTConfig | null = null
	private isConnected: boolean = false
	private reconnectTimer: NodeJS.Timeout | null = null

	public start(config: MQTTConfig): void {
		if (!config.enabled) {
			logger('MQTT service is disabled.', 'info-quiet')
			return
		}

		this.config = config
		this.connect()
	}

	public stop(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}

		if (this.client) {
			this.client.end()
			this.client = null
		}

		this.isConnected = false
		logger('MQTT service stopped.', 'info')
	}

	private connect(): void {
		if (!this.config) return

		try {
			const brokerUrl = `mqtt://${this.config.broker}:${this.config.port}`
			const options: any = {
				clientId: `tallyarbiter_${Date.now()}`,
				clean: true,
				reconnectPeriod: 5000,
				connectTimeout: 10000,
			}

			if (this.config.username) {
				options.username = this.config.username
			}

			if (this.config.password) {
				options.password = this.config.password
			}

			logger(`Connecting to MQTT broker at ${brokerUrl}...`, 'info')
			this.client = mqtt.connect(brokerUrl, options)

			this.client.on('connect', () => {
				this.isConnected = true
				logger('MQTT broker connected successfully.', 'info')
				this.publishStatus('online')
				// Publish initial state for all devices
				this.publishAllDeviceStates()
			})

			this.client.on('error', (error) => {
				logger(`MQTT error: ${error.message}`, 'error')
				this.isConnected = false
			})

			this.client.on('close', () => {
				logger('MQTT broker connection closed.', 'info')
				this.isConnected = false
			})

			this.client.on('reconnect', () => {
				logger('MQTT broker reconnecting...', 'info-quiet')
			})

			this.client.on('offline', () => {
				logger('MQTT broker is offline.', 'info')
				this.isConnected = false
			})
		} catch (error) {
			logger(`Failed to connect to MQTT broker: ${error}`, 'error')
			this.isConnected = false
		}
	}

	public updateDeviceState(deviceId: string, deviceStates: DeviceState[]): void {
		if (!this.isConnected || !this.client || !this.config) return

		const device = devices.find((d) => d.id === deviceId)
		if (!device) return

		const topicPrefix = this.config.topicPrefix || 'tallyarbiter'

		// Publish overall device state as JSON
		const stateTopic = `${topicPrefix}/device/${deviceId}/state`
		const statePayload = JSON.stringify({
			deviceId: device.id,
			deviceName: device.name,
			states: deviceStates.map((ds) => ({
				busId: ds.busId,
				busLabel: currentConfig.bus_options.find((b) => b.id === ds.busId)?.label || 'Unknown',
				sources: ds.sources,
			})),
			timestamp: new Date().toISOString(),
		})

		this.publish(stateTopic, statePayload)

		// Publish individual bus states for easier Home Assistant integration
		for (const deviceState of deviceStates) {
			const bus = currentConfig.bus_options.find((b) => b.id === deviceState.busId)
			if (!bus) continue

			const busTopic = `${topicPrefix}/device/${deviceId}/bus/${deviceState.busId}`
			const isActive = deviceState.sources.length > 0
			const busPayload = JSON.stringify({
				state: isActive ? 'ON' : 'OFF',
				busId: deviceState.busId,
				busLabel: bus.label,
				busType: bus.type,
				sources: deviceState.sources,
				timestamp: new Date().toISOString(),
			})

			this.publish(busTopic, busPayload)

			// Also publish a simple state topic for Home Assistant binary sensors
			const simpleStateTopic = `${topicPrefix}/device/${deviceId}/bus/${deviceState.busId}/state`
			this.publish(simpleStateTopic, isActive ? 'ON' : 'OFF')
		}

		// Publish device availability
		const availabilityTopic = `${topicPrefix}/device/${deviceId}/status`
		this.publish(availabilityTopic, 'online')
	}

	private publishAllDeviceStates(): void {
		// This will be called by the main index.ts after device states are available
		// For now, we'll rely on updateDeviceState being called for each device
	}

	private publishStatus(status: 'online' | 'offline'): void {
		if (!this.config) return

		const topicPrefix = this.config.topicPrefix || 'tallyarbiter'
		const statusTopic = `${topicPrefix}/status`
		this.publish(statusTopic, status)
	}

	private publish(topic: string, payload: string | object): void {
		if (!this.client || !this.isConnected || !this.config) return

		try {
			const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload)
			this.client.publish(
				topic,
				payloadString,
				{
					qos: this.config.qos || 0,
					retain: this.config.retain !== undefined ? this.config.retain : false,
				},
				(error) => {
					if (error) {
						logger(`MQTT publish error for topic ${topic}: ${error.message}`, 'error')
					}
				},
			)
		} catch (error) {
			logger(`MQTT publish error for topic ${topic}: ${error}`, 'error')
		}
	}

	public isServiceConnected(): boolean {
		return this.isConnected
	}
}

