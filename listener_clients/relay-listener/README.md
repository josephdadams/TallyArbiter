# Tally Arbiter Relay Listener
Tally Arbiter Relay Listener was written by Joseph Adams and is distributed under the MIT License.

Tally Arbiter Relay Listener is an accessory program that allows you to connect to a Tally Arbiter server and control USB relays based on the incoming tally information.

To learn more about the Tally Arbiter project, [click here](http://github.com/josephdadams/tallyarbiter).

It is not sold, authorized, or associated with any other company or product.

To contact the author or for more information, please visit [www.techministry.blog](http://www.techministry.blog).

# Running the software
The software is written in Node.js and is therefore cross-platform and can be run on MacOS, Linux, or Windows.

**RUNNING DIRECTLY WITHIN NODE:**
1. Install Node.js if not already installed. <https://nodejs.org/en/download/> If installing on a Windows PC, ensure that the option to install Tools for Native Modules is selected otherwise the installation of Tally Arbiter Relay Listener will fail.
1. If installing on a Pi, run `sudo apt install libudev-dev libusb-1.0-0-dev`: The `libusb` library is necessary to communicate with the USB relay.
1. Download the Tally Arbiter source code.
1. Open a terminal window and change directory to the folder where you placed the source code.
1. Type `npm install` to install all necessary libraries.
1. Type `node index.js` within the this folder. If you receive a permissions error, you may need to run the software as root, with `sudo node index.js`.
1. If this folder does not contain the `config_relays.json` file, an error will occur. A sample configuration file is provided.

**RUNNING AS A SERVICE:**
1. Install Node.js if not already installed.  Again, if installing on a Windows PC, ensure that the option to install Tools for Native Modules is selected otherwise the installation of Tally Arbiter Relay Listener will fail.
1. If installing on a Pi, run * `sudo apt install libudev-dev libusb-1.0-0-dev`: The `libusb` library is necessary to communicate with the USB relay.
1. Open a terminal window and change directory to the folder where you placed the source code.
1. Type `npm install` to install all necessary libraries.
1. Install the Node.js library, `pm2`, by typing `npm install -g pm2`. This will install it globally on your system.
1. After `pm2` is installed, type `pm2 start index.js --name TallyArbiterRelayListener` to daemonize it as a service. If you receive a permissions error, you may need to run the software as root, with `sudo start index.js --name TallyArbiterRelayListener`.
1. If you would like it to start automatically upon bootup, type `pm2 startup` and follow the instructions on-screen.
1. To view the console output while running the software with `pm2`, type `pm2 logs TallyArbiterRelayListener`.

Upon startup, the program will enumerate through the `config_relays.json` file and attempt to connect to the specified Tally Arbiter server.

# Relay Hardware
Tally Arbiter Relay Listener supports USB relays with up to 8 separate relays. If you need more relays, run the program on more devices. It is designed to run on a Raspberry Pi Zero for a low cost of entry.

The USB library is designed to work with these types of relays:
![picture alt](https://github.com/josephdadams/USBRelay/raw/master/usbrelay.jpg "USB Relay")

# Configuration
The `config_relays.json` file contains two sections:

* `server_config`: The IP and Port of the Tally Arbiter server.
```javascript
 "server_config":
 {
	"ip": "192.168.11.141",
	"port": 4455
 }
```

* `relay_groups`: The groupings of relays that you want to control. Each Relay Group can be associated with one Tally Arbiter Device.

Example `relay_group` entry:
```javascript
{
	"id": 1,
	"relays": [
		{
			"relayNumber": 1,
			"busType": "preview",
		},
		{
			"relayNumber": 2,
			"busType": "program"
		}
	],
	"deviceId": "ed34bacd"
}
```

* `id`: A unique identifier.
* `relays`: The array of relays assciated in this group. It has the following properties:
	* `relayNumber`: The actual relay number on the relay board. (1-8)
	* `busType`: Either `preview` or `program`.
* `deviceId`: If configured, the Tally Arbiter Device Id. If this Device Id is invalid or the property does not exist in your config file, Tally Arbiter will automatically reassign this relay group to the first Device on the server. You can reassign it to a new Device using the Tally Arbiter interface.

Each Relay Group will be represented as a listener client on the Tally Arbiter server.

Once your configuration file is created and you've made the physical connections to your contact closure devices, start up the Tally Arbiter Relay Listener and it will attempt to connect to the Tally Arbiter Server.

# Improvements and Suggestions
I welcome all improvements and suggestions. You can submit issues and pull requests, or contact me through [my blog](http://www.techministry.blog).