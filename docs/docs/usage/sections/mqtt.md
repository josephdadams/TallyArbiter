---
sidebar_position: 6
---

# MQTT

Tally Arbiter can publish device tally states to an MQTT broker, enabling integration with home automation systems like Home Assistant, openHAB, Node-RED, and other IoT platforms. This allows you to monitor and react to tally states in real-time through your smart home or automation setup.

## Configuration

MQTT can be configured through the Tally Arbiter settings interface or by editing the configuration file directly. The MQTT configuration section includes the following options:

### Required Settings

- **Enabled**: Enable or disable the MQTT integration (default: `false`)
- **Broker**: MQTT broker hostname or IP address (default: `localhost`)
- **Port**: MQTT broker port (default: `1883`)
- **Topic Prefix**: Prefix for all MQTT topics (default: `tallyarbiter`)
- **Retain**: Whether to retain MQTT messages (default: `true`)
- **QoS**: Quality of Service level - `0`, `1`, or `2` (default: `0`)

### Optional Settings

- **Username**: MQTT broker username (if authentication is required)
- **Password**: MQTT broker password (if authentication is required)
- **Reconnect Period**: Time in milliseconds between reconnection attempts (default: `5000`)
- **Connect Timeout**: Connection timeout in milliseconds (default: `10000`)
- **Keepalive**: Keepalive interval in seconds (default: `60`)
- **Client ID**: Custom MQTT client ID (auto-generated if not provided)

### Example Configuration

```json
{
  "mqtt": {
    "enabled": true,
    "broker": "192.168.1.100",
    "port": 1883,
    "username": "tallyarbiter",
    "password": "your_password",
    "topicPrefix": "tallyarbiter",
    "retain": true,
    "qos": 1,
    "reconnectPeriod": 5000,
    "connectTimeout": 10000,
    "keepalive": 60
  }
}
```

## MQTT Topics

Tally Arbiter publishes device states to several MQTT topics following a structured hierarchy:

### Service Status

- **`{topicPrefix}/status`**: Overall service status (`online` or `offline`)

### Device State Topics

For each device, Tally Arbiter publishes:

1. **`{topicPrefix}/device/{deviceId}/state`**: Complete device state as JSON
   ```json
   {
     "deviceId": "device-123",
     "deviceName": "Camera 1",
     "states": [
       {
         "busId": "bus-1",
         "busLabel": "Program",
         "sources": ["source-1", "source-2"]
       }
     ],
     "timestamp": "2024-01-15T10:30:00.000Z"
   }
   ```

2. **`{topicPrefix}/device/{deviceId}/bus/{busId}`**: Individual bus state as JSON
   ```json
   {
     "state": "ON",
     "busId": "bus-1",
     "busLabel": "Program",
     "busType": "program",
     "busColor": "#ff0000",
     "sources": ["source-1"],
     "timestamp": "2024-01-15T10:30:00.000Z"
   }
   ```

3. **`{topicPrefix}/device/{deviceId}/bus/{busId}/state`**: Simple bus state (`ON` or `OFF`)
   - This topic contains just the state string, making it ideal for Home Assistant binary sensors

4. **`{topicPrefix}/device/{deviceId}/status`**: Device availability status (`online`)

### Topic Examples

With the default topic prefix `tallyarbiter` and a device ID `camera-1` with bus ID `program-bus`:

- `tallyarbiter/status` - Service status
- `tallyarbiter/device/camera-1/state` - Complete device state
- `tallyarbiter/device/camera-1/bus/program-bus` - Program bus state (JSON)
- `tallyarbiter/device/camera-1/bus/program-bus/state` - Program bus state (ON/OFF)
- `tallyarbiter/device/camera-1/status` - Device availability

## Home Assistant Integration

The MQTT integration is designed to work seamlessly with Home Assistant. You can create binary sensors, sensors, and automations based on tally states.

### Example Home Assistant Configuration

```yaml
# binary_sensor.yaml
- platform: mqtt
  name: "Camera 1 Program Tally"
  state_topic: "tallyarbiter/device/camera-1/bus/program-bus/state"
  payload_on: "ON"
  payload_off: "OFF"
  device_class: running

# sensor.yaml
- platform: mqtt
  name: "Camera 1 Tally State"
  state_topic: "tallyarbiter/device/camera-1/state"
  value_template: "{{ value_json.states[0].busLabel if value_json.states else 'Clear' }}"
  json_attributes_topic: "tallyarbiter/device/camera-1/state"
  json_attributes_template: "{{ value_json | tojson }}"
```

### Home Assistant Automation Example

```yaml
# automation.yaml
- alias: "Turn on studio lights when camera 1 is on program"
  trigger:
    - platform: mqtt
      topic: "tallyarbiter/device/camera-1/bus/program-bus/state"
      payload: "ON"
  action:
    - service: light.turn_on
      target:
        entity_id: light.studio_lights
```

## Node-RED Integration

You can use Node-RED to subscribe to MQTT topics and create custom automations:

1. Add an MQTT In node
2. Configure it to subscribe to `tallyarbiter/device/+/bus/+/state` (using wildcards)
3. Process the messages in your flow
4. Trigger actions based on tally states

## Connection Management

- Tally Arbiter automatically reconnects to the MQTT broker if the connection is lost
- The reconnection period is configurable (default: 5 seconds)
- Connection status is logged in the Tally Arbiter console
- When the service starts, it publishes an `online` status and all current device states

## Best Practices

1. **Enable message retention** if you want new subscribers to receive the last known state immediately
2. **Use a unique topic prefix** if running multiple Tally Arbiter instances
3. **Secure your MQTT broker** with authentication when exposing it to a network
4. **Monitor the connection** - check the Tally Arbiter logs for connection status

## Troubleshooting

- **No messages received**: Check that MQTT is enabled in the configuration and the broker address/port are correct
- **Connection failures**: Verify network connectivity and broker credentials
- **Missing device states**: Ensure devices are configured and have sources assigned
- **Check logs**: Tally Arbiter logs MQTT connection events and errors to help diagnose issues

