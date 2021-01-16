# Tally Arbiter
Tally Arbiter was written by Joseph Adams and is distributed under the MIT License.

It is not sold, authorized, or associated with any other company or product.

To contact the author or for more information, please visit [www.techministry.blog](http://www.techministry.blog).

Tally Arbiter is software that allows you to combine incoming tally data from multiple sources or video switchers such as Ross Carbonite (through the TSL 3.1 protocol), Blackmagic ATEM or VideoHub, OBS Studio, VMix, etc. and arbitrate the bus state across all of the sources so that devices like cameras can accurately reflect tally data coming from those multiple locations without each device having to be connected to all sources simultaneously.

# Features
* Supports many different tally sources/switchers
* Supports output of tally data to several different types (web/phone, blink(1) USB light, relay, GPO, M5StickC/Arduino)
* Outgoing webhooks, TCP messages, or OSC based on tally states
* Unlimited tally sources and devices
* Cloud Support - send data from your closed production network to a server in the cloud
* Feedbacks and Control through Bitfocus Companion - view tally data live on your stream deck!
* Emulates a VMix Server, making it compatible with your favorite VMix Tally Client
* Send Messages from the Server to supported clients

# Videos
* Introduction and Walkthrough: https://youtu.be/msfAL631ARw
* Using Tally Arbiter for TSL 3.1 Protocol Conversion: https://youtu.be/iZd0_K21k6U
* Using Tally Arbiter Cloud to view tally data from anywhere: https://youtu.be/yvWg1NuH248
* Feedback and Control with Bitfocus Companion: https://youtu.be/osvbW4XHu0I
* Using an M5StickC Arduino for viewing tally: https://youtu.be/WMrRKD63Jrw
* Tally Arbiter 1.4: https://youtu.be/F_Y8Rflo8cY
* Tally Arbiter 1.5: https://youtu.be/zar6-x7hT4M

# Installing the software
The software is written in Node.js and is therefore cross-platform and can be run on MacOS, Linux, or Windows.

You must have Node.js installed for the software to run. You can download it here: <https://nodejs.org/en/download/>

If on MacOS, you may need to download and install XCode Command Line Tools.

Download the Tallly Arbiter source code. You can download it directly from GitHub, or you can use `git` from the command line to download the files.

To use `git`, you must have it installed: <https://git-scm.com/book/en/v2/Getting-Started-Installing-Git>
Type `git clone https://github.com/josephdadams/tallyarbiter` to download the source code. This will download to a subfolder of your current working folder.

After downloading the software, type `npm install` to install all necessary libraries and packages.

# Upgrading the software
If you downloaded the software using `git`, upgrades are simple. In the terminal window, change directly to the Tally Arbiter folder, and then type: `git pull`. This will download the latest source code.

If you downloaded the source code manually, just replace the files in the folder manually.

**Be Sure to back up or save your `config.json` file!**

Now run `npm install` to make sure all packages are up to date.

# Running the software

**RUNNING DIRECTLY WITHIN NODE:**
1. Open a terminal window and change directory to the folder where you placed the source code.
1. Type `node index.js` within this folder to run the program. *If this folder does not contain a `config.json` configuration file, a new one will be created the next time you use the API or the Settings page.*

**RUNNING AS A SERVICE:**
1. Open a terminal window and change directory to the folder where you placed the source code.
1. Install the Node.js library, `pm2`, by typing `npm install -g pm2`. This will install it globally on your system.
1. After `pm2` is installed, type `pm2 start index.js --name TallyArbiter` to daemonize it as a service.
1. If you would like it to start automatically upon bootup, type `pm2 startup` and follow the instructions on-screen.
1. To view the console output while running the software with `pm2`, type `pm2 logs TallyArbiter`.

This program runs an HTTP server listening on port `4455`. If this port is in use and cannot be opened, you will receive an error.

Upon startup, the program will enumerate through all stored incoming tally connections and open them.

# Configuration
Once running, a web interface is available to view tally sources, devices, and other information at `/settings`: <http://127.0.0.1:4455/settings>
**This page is restricted by a username and password. The default username is `admin` and the default password is `12345`.**
You can change the security of this area by adding the following section to your `config.json` file:
```javascript
{
	"security":
	{
		"username_settings": "admin",
		"password_settings": "12345",
		"username_producer": "producer",
		"password_producer": "12345"
	}
}
```

Tally Arbiter consists of the following sections:

## Sources
Sources represent all of the tally data that is generated. This is usually your video switcher or mixing software. Multiple sources can be added and they can all be different types.

The following source types are supported:
* TSL 3.1 UDP/TCP (Ross switchers, Streamstar, etc.)
* Blackmagic ATEM
* Blackmagic VideoHub
* OBS Studio
* StudioCoast VMix
* Roland Smart Tally
* Roland VR-50HD-MKII
* Newtek Tricaster
* Open Sound Control (OSC)
* Analog Way Livecore Image Processors

When you add a source and the connection to the tally source (video switcher, software, etc.) is successfully made, the source will be green. If there is an error, the source will be red. Look at the logs for more error information.

### TSL 3.1 UDP/TCP
Your switcher or service that uses this protocol must be configured to send the data to Tally Arbiter at the port you specify.

### Blackmagic ATEM
You will need the IP address of the ATEM. The ATEM can only have 5 simultaneous connections, so you may need to disconnect another connection in order for Tally Arbiter to connect to the ATEM.

### Blackmagic VideoHub
You will need the IP address of the VideoHub. You can choose to have any destination be configured as a preview bus, program bus, or both. Enter multiple destination routes by separating them with commas.

### OBS Studio
The `obs-websockets` plugin must be installed and configured in order for Tally Arbiter to connect. You can get the plugin here: https://github.com/Palakis/obs-websocket/releases

You will need to supply the IP address, port, and password configured in the OBS Websockets plugin.

### StudioCoast VMix
You will need the IP address of the computer running VMix.

### Roland Smart Tally
You will need the IP address of the Roland switcher.

### Roland VR-50HD-MKII
You will need the IP address of the Roland switcher.

### Newtek Tricaster
You will need the IP address of the Tricaster.

### Open Sound Control (OSC)
Incoming OSC data can be used to trigger device tally states. Configure the port as desired.

OSC paths must be one of the following:
* `/tally/preview_on`: Puts the device in Preview mode.
* `/tally/preview_off`: Turns off Preview mode for the device.
* `/tally/program_on`: Puts the device in Program mode.
* `/tally/program_off`: Turns off Program mode for the device.
* `/tally/previewprogram_on`: Puts the device in both Preview and Program mode.
* `/tally/previewprogram_off`: Turns off both Preview and Program Program mode for the device.

The device source address should be sent as an integer or a string. Send one argument of any type (integer, float, or string). If you send multiple arguments, they will be ignored.

### Analog Way Livecore Image Processors
You will need the IP address of the device, and the port (standard port is 10600).

## Devices
Devices represent your inputs (like cameras) that you want to track with tally data. Devices can be assigned different addresses or inputs by each source. In Tally Arbiter, you can create as many devices as you would like and give each one a helpful name and description.

### Device Sources
In order to assciate tally data with a device, you must assign the source addresses to each device. These addresses can vary from source to source, so they must be manually assigned.

For example, a Camera can be connected to a `Blackmagic ATEM` on `Input 1`, but connected to an `OBS Studio` on `Scene 2`. Tally Arbiter will track the tally data from each source and arbitrate whether the device is ultimately in preview or program (or both) by aggregating all of the source data together.

To assign a Source to a Device, click "Device Sources" next to a Device in the list. Choose the enabled Source from the drop down list, type in the address, and click Add.

#### Linking Device Sources
Device Sources can be "linked" on either the Preview Bus, the Program Bus, or both. If linked, this means that a Device is not considered to be active in that Bus unless Tally Arbiter has determined that the Device is active in that Bus **across all Sources** assigned to that Device.

#### A Note About Addresses
The source address is typically the actual input number on the switcher. So, if your camera on your ATEM comes in on Input 5, just enter `5`. However, if you're using a source like OBS Studio, your address might be a string, like `Scene 2` or `Image 1`. Some Source Types also support selecting the Device Address via a list.

### Device Actions
Once a device is assigned to a source(s), if a matching condition is met, an action can be performed. You can specify whether the action should be run when the device is entering a bus or leaving a bus, which is helpful for bus-specific actions like operating a relay. Multiple actions are supported per device and per bus (preview and program).

The following Device Actions are implemented:
* TSL 3.1 UDP/TCP
* Outgoing Webhook
* Generic TCP
* Local Console Output/Logging (useful for testing)
* Open Sound Control (OSC) (multiple arguments supported)

Device Actions can only be run once when the device state enters or exits that bus. This is to prevent actions from being run continuously if tally data is received in chunks. To run an action again, a device must change state on that specific bus (Preview or Program) before it can be run again.

# Remote Tally Viewing (Listener Clients)
In addition to the multiple output action types that can be used to trigger any number of remote devices for a tally state, Tally Arbiter also supports "listener clients": devices and software that open websocket connections to the Tally Arbiter server and can receive data in real time to utilize tally information.

All connected listener clients are tracked and listed in the Settings page. You can "flash" a particular listener by clicking the Flash button next to it in the list. This is useful if you need to get the operator's attention or determine which listener is which. You can also reassign the listener to receive tally information of another Device at any time using the Tally Arbiter interface.

## Using a web page for tally output
Navigate to `/tally` on the Tally Arbiter server in your browser and select a Device from the list. As long as the page remains connected to the system, it will display tally data (Preview, Program, Preview+Program, Clear) in real time. Web clients can also send/receive messages with the Producer, like a chat room.

## Viewing all tally data
Navigate to `/producer` on the Tally Arbiter server in your browser to view all Devices and their current states. This information is also available in the Settings GUI but is displayed in a minimal fashion here for in-service viewing. Messages can be sent and received to supported clients.
**This page is restricted by a username and password. The default username is `producer` and the default password is `12345`.**

## Using an M5StickC for tally output
Tally Arbiter can send tally data to an M5StickC Arduino Finger Computer. A remote script is available in the separate repository, [Tally Arbiter M5StickC Listener](http://github.com/josephdadams/tallyarbiter-m5stickclistener). For installation and use instructions, please check out that repository's [readme](https://github.com/josephdadams/TallyArbiter-M5StickCListener/blob/master/readme.md).

## Using an M5 Atom Matrix for tally output
Tally Arbiter can send tally data to an M5 Atom Matrix. A remote script is available in the separate repository, [Tally Arbiter M5 Atom Matrix Listener](http://github.com/josephdadams/tallyarbiter-m5atommatrixlistener). For installation and use instructions, please check out that repository's [readme](https://github.com/josephdadams/TallyArbiter-M5AtomMatrixListener/blob/master/readme.md).

## Using a blink(1) for tally output
Tally Arbiter supports the use of a USB blink(1) device as a tally light. A remote listening script is available in the separate repository, [Tally Arbiter Blink1 Listener](http://github.com/josephdadams/tallyarbiter-blink1listener). For installation and use instructions, please check out that repository's [readme](https://github.com/josephdadams/TallyArbiter-Blink1Listener/blob/master/readme.md). It is compatible with and was designed to run on a Raspberry Pi Zero, making this an inexpensive option for *wireless* tally output. However, it can be run on any OS/device that supports Python such as MacOS or Windows, which can be helpful if you want to use this with graphics or video playback operators, for example.

## Using a Relay for contact-closure systems
Many Camera CCUs and other devices support incoming tally via contact closure. A remote listening script that can trigger USB relays is available with the separate repository, [Tally Arbiter Relay Listener](http://github.com/josephdadams/tallyarbiter-relaylistener). For installation and use instructions, please check out that repository's [readme](https://github.com/josephdadams/TallyArbiter-RelayListener/blob/master/readme.md).

## Using a GPO output
Lots of equipment support the use of GPIO (General Purpose In/Out) pins to interact. This could be for logic control, turning on LEDs, etc. A remote listening script that can run on a Raspberry Pi is available with the separate repository, [Tally Arbiter GPO Listener](http://github.com/josephdadams/tallyarbiter-gpolistener). For installation and use instructions, please check out that repository's [readme](https://github.com/josephdadams/TallyArbiter-GPOListener/blob/master/readme.md).

## Arduino ESP8266 with Neopixel
Use AdaFruit NeoPixel LED strips connected to an Arduino. Check out [NoahCallaway](http://github.com/noahcallaway/)'s repository for more information: https://github.com/NoahCallaway/TallyArbiter-arduino-neopixel

## VMix Tally Emulation
Tally Arbiter will also emulate a VMix server, which means you can use any compatible VMix tally client to view tally as well, such as the [VMix M5Stick Tally Light](https://github.com/guido-visser/vMix-M5Stick-Tally-Light) project by Guido Visser. Follow the instructions on that repository to set up your M5Stick device, and specify Tally Arbiter as your VMix server!

## Creating your own listener client
Tally Arbiter can send data over the socket.io protocol to your listener. You can make use of the following event emitters:
* `bus_options`: Send no arguments; Returns a `bus_options` event with an array of available busses (preview and program).
* `devices`: Send no arguments; Returns a `devices` event with an array of configured Tally Arbiter Devices.
* `device_listen`: Send a deviceId and a listener type (string); Returns a `device_states` event with an array of current device states for that device Id. This will add the listener client to the list in Tally Arbiter, making it manageable in the Settings interface.
* `device_states`: Send a deviceId as the argument; Returns a `device_states` event with an array of current device states for that device Id.

# TSL 3.1 Protocol Conversion
Tally Arbiter can automatically send out TSL 3.1 data to any number of clients. This is helpful if you want to have Tally Arbiter aggregate all of your tally data and then send out updates to UMDs, multiviewers, etc.
* Each device must have a TSL Address configured. The default TSL address is `0`.
* Add a TSL Client by using the "TSL Clients" configuration area in the Settings interface.
* Specify the IP address, Port, and Transport Type (UDP or TCP).
* Tally Arbiter will send TSL 3.1 data to these clients any time a device changes state.

# Configuring and Using Tally Arbiter Cloud
Tally Arbiter can send source, device, and tally data from a local instance within a closed network to an instance of Tally Arbiter on another network that may be more acccessible for end users. This is helpful if your users need to access Tally Arbiter and you don't want to have them tunnel or connect into your private network, or if users are located remotely.

* On the cloud server, create a new Cloud Key. This is like a password.
* On the local server, create a new Cloud Destination specifying the host, port, and cloud key. Multiple local servers can utilize the same cloud key.
* Once a connection is established, all sources, devices, and tally data from the local server will be relayed up to the cloud server.
* Tally Arbiter will handle this incoming tally data as it would any local source.
* You can also flash/ping listener clients the same way you would if they were local.
* **If a Tally Arbiter Cloud Client is removed, all Sources and Devices associated with that Cloud Client will be removed.**

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

# Improvements and Suggestions
I welcome all improvements and suggestions. You can submit issues and pull requests, or contact me through [my blog](http://www.techministry.blog).