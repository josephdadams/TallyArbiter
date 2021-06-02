---
sidebar-position: 1
---


# Using the REST API
The Web GUI is the most complete way to interact with the software, however the following API's are available (`HTTP GET` method unless otherwise noted):
* `/version` will retrieve the version of the software, based on the information specified in `package.json`.
* `/settings/source_types`: Returns the available source types
* `/settings/source_types_datafields`: Returns the source types' datafields needed to properly interact with the source (IP address, port, etc.)
* `/settings/output_types`: Returns the available output types
* `/settings/output_types_datafields`: Returns the output types' datafields needed to properly send tally data to the output (device action).
* `/settings/bus_options`: The bus options available to the system. (Preview and Program)
* `/settings/sources`: The currently configured Sources.
* `/settings/devices`: The currently configured Devices.
* `/settings/device_sources`: The relationships between Devices and Sources.
* `/settings/device_actions`: The actions (outputs) for each Device depending on the Bus conditions that are met.
* `/settings/device_states`: The current tally data for all Devices.
* `/settings/tsl_clients`: The TSL Clients currently configured on the server.
* `/settings/cloud_destinations`: The Cloud Destinations currently configured on the server.
* `/settings/listener_clients`: The Listener Clients currently connected to the server.
* `/settings/flash/[clientId]`: Flash a Listener Client. `[clientId]` is the id of the Listener Client.
* `/settings/manage`: POST with JSON, used to manage (add, edit, delete) all Sources, Devices, Device Sources, and Device Actions. Each request object must include the following:
	* `action`: `add`, `edit`, or `delete`
	* `type:`: `source`, `device`, `device_source`, `device_action`, `tsl_client`, `cloud_destination`, `cloud_key`, `cloud_client`.

	If adding or editing a Source, then you must include a `source` object.
	Example:
	```javascript
	{
		"action": "add",
		"type": "source",
		"source": {
			"name": "ATEM 1",
			"sourceTypeId": "dc75100e",
			"data": {
				"ip": "192.168.1.240"
			}
		}
	}
	```

	If deleting a Source, then simply include a `sourceId` property.
	Example:
	```javascript
	{
		"action": "delete",
		"type": "source",
		"sourceId": "836223ea"
	}
	```

	The other categories (Devices, Device Sources, Device Actions) follow a similar protocol.

The API will respond with JSON messages for each request received.
* `source-added-successfully`: The source was successfully added to the system.
* `source-edited-successfully`: The source was successfully edited in the system.
* `source-deleted-successfully`: The source was successfully deleted from the system.
* `device-added-successfully`: The Device was successfully added to the system.
* `device-edited-successfully`: The Device was successfully edited in the system.
* `device-deleted-successfully`: The Device was successfully deleted from the system.
* `device-source-added-successfully`: The Device Source was successfully added to the system.
* `device-source-edited-successfully`: The Device Source was successfully edited in the system.
* `device-source-deleted-successfully`: The Device Source was successfully deleted from the system.
* `device-action-added-successfully`: The Device Action was successfully added to the system.
* `device-action-edited-successfully`: The Device Action was successfully edited in the system.
* `device-action-deleted-successfully`: The Device Action was successfully deleted from the system.
* `tsl-client-added-successfully`: The TSL Client was successfully added to the system.
* `tsl-client-edited-successfully`: The TSL Client was successfully edited in the system.
* `tsl-client-deleted-successfully`: The TSL Client was successfully deleted from the system.
* `cloud-destination-added-successfully`: The Cloud Destination was successfully added to the system.
* `cloud-destination-edited-successfully`: The Cloud Destination was successfully edited in the system.
* `cloud-destination-deleted-successfully`: The Cloud Destination was successfully deleted from the system.
* `cloud-key-added-successfully`: The Cloud Key was successfully added to the system.
* `cloud-key-deleted-successfully`: The Cloud Key was successfully deleted from the system.
* `flash-sent-successfully`: The Listener Client was flashed successfully.
* `flash-not-sent`: The specified Listener Client could not be located or another error occurred.
* `error`: An unexpected error occurred. Check the `error` property for more information.

The console/terminal output running the server process is also verbose and will report on the current status of the server while in use. All console output is reported to the Logs area of the Settings page.
