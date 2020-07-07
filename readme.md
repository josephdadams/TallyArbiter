# Tally Arbiter
Tally Arbiter was written by Joseph Adams and is distributed under the MIT License.

It is not sold, authorized, or associated with any other company or product.

To contact the author or for more information, please visit [www.techministry.blog](http://www.techministry.blog).

Tally Arbiter is software that allows you to combine incoming tally data from multiple sources such as TSL UMD 3.1, Blackmagic ATEM, OBS Studio, VMix, Roland Smart Tally, etc. and arbitrate the bus state across all of the sources so that devices like cameras can accurately reflect tally data coming from those multiple locations without each device having to be connected to all sources simultaneously.

# Running the software
The software is written in Node.js and is therefore cross-platform and can be run on MacOS, Linux, or Windows.

**RUNNING DIRECTLY WITHIN NODE:**
1. Install Node.js if not already installed. <https://nodejs.org/en/download/>
1. Download the Tally Arbiter source code.
1. Open a terminal window and change directory to the folder where you placed the source code.
1. Type `npm install` to install all of the necessary libraries.
1. Type `node index.js` within this folder to run the program. *If this folder does not contain a `config.json` configuration file, a new one will be created the next time you use the API or the Settings page.*

**RUNNING AS A SERVICE:**
1. Install Node.js if not already installed.
1. Open a terminal window and change directory to the folder where you placed the source code.
1. Type `npm install` to install all of the necessary libraries.
1. Install the Node.js library, `pm2`, by typing `npm install -g pm2`. This will install it globally on your system.
1. After `pm2` is installed, type `pm2 start index.js --name TallyArbiter` to daemonize it as a service.
1. If you would like it to start automatically upon bootup, type `pm2 startup` and follow the instructions on-screen.
1. To view the console output while running the software with `pm2`, type `pm2 logs TallyArbiter`.

This program runs an HTTP server listening on port `4455`. If this port is in use and cannot be opened, you will receive an error.

Upon startup, the program will enumerate through all stored incoming tally connections and open them.

# Configuration
Once running, a web interface is available to view tally sources, devices, and other information at `/settings`: <http://127.0.0.1:4455/settings>

Tally Arbiter consists of the following sections:

## Sources
Sources represent all of the tally data that is generated. This is usually your video switcher or mixing software. Multiple sources can be added and they can all be different types.

The following source types are supported:
* TSL 3.1 UDP/TCP (Ross switchers, etc.)
* Blackmagic ATEM
* OBS Studio
* StudioCoast VMix
* Roland Smart Tally
* Open Sound Control (OSC)

### TSL 3.1 UDP/TCP
Your switcher that uses this protocol must be configured to send the data to Tally Arbiter.

### Blackmagic ATEM
You will need the IP address of the ATEM. The ATEM can only have 5 simultaneous connections, so you may need to disconnect another connection in order for Tally Arbiter to connect to the ATEM.

### OBS Studio
The `obs-websockets` plugin must be installed and configured in order for Tally Arbiter to connect. You can get the plugin here: https://github.com/Palakis/obs-websocket/releases

You will need to supply the IP address, port, and password configured in the OBS Websockets plugin.

### StudioCoast VMix
You will need the IP address of the computer running VMix.

### Roland Smart Tally
You will need the IP address of the Roland switcher.

### Open Sound Control (OSC)
Incoming OSC data can be used to trigger device tally states. Configure the port as desired.

OSC paths must be one of the following:
* `/tally/preview_on`: Puts the device in Preview mode.
* `/tally/preview_off`: Turns off Preview mode for the device.
* `/tally/program_on`: Puts the device in Program mode.
* `/tally/program_off`: Turns off Program mode for the device.

Send one argument of any type (integer, float, or string). If you send multiple arguments, they will be ignored.

## Devices
Devices represent your inputs (like cameras) that you want to track with tally data. Devices can be assigned different addresses or inputs by each source. In Tally Arbiter, you can create as many devices as you would like and give each one a helpful name and description.

### Device Sources
In order to assciate tally data with a device, you must assign the source addresses to each device. These addresses can vary from source to source, so they must be manually assigned.

For example, a Camera can be connected to a `Blackmagic ATEM` on `Input 1`, but connected to an `OBS Studio` on `Scene 2`. Tally Arbiter will track the tally data from each source and arbitrate whether the device is ultimately in preview or program (or both) by aggregating all of the source data together.

To assign a Source to a Device, click "Device Sources" next to a Device in the list. Choose the enabled Source from the drop down list, type in the address, and click Add.

#### A Note About Addresses
The source address is typically the actual input number on the switcher. So, if your camera on your ATEM comes in on Input 5, just enter `5`. However, if you're using a source like OBS Studio, your address might be a string, like `Scene 2`.

### Device Actions
Once a device is assigned to a source(s), if a matching condition is met, an action can be performed. You can specify whether the action should be run when the device is entering a bus or leaving a bus, which is helpful for bus-specific actions like operating a relay. Multiple actions are supported per device and per bus (preview and program).

The following output types are supported:
* TSL 3.1 UDP/TCP
* Outgoing Webhook
* Local Console Output/Logging (useful for testing)
* Open Sound Control (OSC) (multiple arguments supported)

Device Actions can only be run once when the device state enters or exits that bus. This is to prevent actions from being run continuously if tally data is received in chunks. To run an action again, a device must change state on that specific bus (Preview or Program) before it can be run again.

# Remote Tally Viewing (Listener Clients)
In addition to the multiple output action types that can be used to trigger any number of remote devices for a tally state, Tally Arbiter also supports "listeners", devices and software that open websocket connections to the Tally Arbiter server and can receive data in real time to utilize tally information.

All connected listener clients are tracked and listed in the Settings page. You can "flash" a particular listener by clicking the Flash button next to it in the list. This is useful if you need to get the operator's attention or determine which listener is which. You can also reassign the listener to receive tally information of another Device at any time using the Tally Arbiter interface.

## Using a web page for tally output
Navigate to `/tally` on the Tally Arbiter server in your browser and select a Device from the list. As long as the page remains connected to the system, it will display tally data (Preview, Program, Preview+Program, Clear) in real time.

## Viewing all tally data
Navigate to `/producer` on the Tally Arbiter server in your browser to view all Devices and their current states. This information is also available in the Settings GUI but is displayed in a minimal fashion here for in-service viewing.

## Using a blink(1) for tally output
Tally Arbiter also supports the use of a blink(1) device by running the included Python script, `tallyarbiter_listener.py`. Python was chosen over Node.js for the ease of installation and use on a Raspberry Pi. It is compatible with and was designed to run on a Raspberry Pi Zero, making this an inexpensive option for *wireless* tally output. However, it can be run on any OS/device that supports Python such as MacOS or Windows, which can be helpful if you want to use this with graphics or video playback operators, for example.

For a more complete walkthrough of setting up the Raspberry Pi Zero from scratch, [read this document](raspberry-pi-listener.md).

You must install the following Python dependencies:
* `pip3 install blink1`
* `pip3 install "python-socketio[client]"`

Run the script:

`python3 tallyarbiter.py [server] [port] [deviceId]`
* `[server]` is the IP address of the Tally Arbiter server.
* `[port]` is the Port of the Tally Arbiter server (usually `4455`)
* `[deviceId]` is the deviceId of the Device (camera, etc.) that you want to follow. If you leave this blank, it will automatically select the first Device found on the server. You can reassign it if needed.

A constant blinking white light on the blink(1) USB device means the Listener is attempting to connect to the Tally Arbiter server. The same light will flash white when it is reassigned.

## Using a Relay for contact-closure systems
Many Camera CCUs and other devices support incoming tally via contact closure. A remote listening script that can trigger USB relays is available with the separate repository, [Tally Arbiter Relay Controller](http://github.com/josephdadams/tallyarbiterrelaycontroller). For installation and use instructions, please check out that repository's [readme](http://github.com/josephdadams/tallyarbiterrelaycontroller/readme.md).

# Using the API
The Web GUI is the most complete way to interact with the software, however the following API's are available:
* `/source_types`: Returns the available source types
* `/source_types_datafields`: Returns the source types' datafields needed to properly interact with the source (IP address, port, etc.)
* `/output_types`: Returns the available output types
* `/output_types_datafields`: Returns the output types' datafields needed to properly send tally data to the output (device action).
* `/bus_options`: The bus options available to the system. (Preview and Program)
* `/sources`: The currently configured Sources.
* `/devices`: The currently configured Devices.
* `/device_sources`: The relationships between Devices and Sources.
* `/device_actions`: The actions (outputs) for each Device depending on the Bus conditions that are met.
* `/device_states`: The current tally data for all Devices.
* `/clients`: The Listener Clients currently connected to the server.
* `/flash/[clientId]`: Flash a Listener Client. `[clientId]` is the id of the Listener Client.
* `/version` will retrieve the version of the software, based on the information specified in `package.json`.
* `/manage`: POST with JSON, used to manage (add, edit, delete) all Sources, Devices, Device Sources, and Device Actions. Each request object must include the following:
	* `action`: `add`, `edit`, or `delete`
	* `type:`: `source`, `device`, `device_source`, or `device_action`.

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
		"action": "edit",
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
* `flash-sent-successfully`: The Listener Client was flashed successfully.
* `flash-not-sent`: The specified Listener Client could not be located or another error occurred.
* `error`: An unexpected error occurred. Check the `error` property for more information.

The console/terminal output running the server process is also verbose and will report on the current status of the server while in use. All console output is reported to the Logs area of the Settings page.

# Improvements and Suggestions
I welcome all improvements and suggestions. You can submit issues and pull requests, or contact me through [my blog](http://www.techministry.blog).