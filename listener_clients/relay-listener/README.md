# Tally Arbiter Relay Listener

Tally Arbiter Relay Listener was written by Joseph Adams and is distributed under the MIT License.

Tally Arbiter Relay Listener is an accessory program that allows you to connect to a Tally Arbiter server and control USB relays based on the incoming tally information.

To learn more about the Tally Arbiter project, [click here](http://github.com/josephdadams/tallyarbiter).

It is not sold, authorized, or associated with any other company or product.

You can buy a USB relay here:
[2 Channel](https://www.amazon.com/NOYITO-2-Channel-Computer-Drive-free-Controller/dp/B07CFQMDJ3/),
[4 Channel](https://www.amazon.com/Diyeeni-4-Channel-Controller-Expansion-Automation/dp/B084TNPG8T/), or
[8 Channel](https://www.amazon.com/Zer-one-8-Channel-Computer-Intelligent/dp/B07XPFK1ZM/).

To [report a bug](https://github.com/josephdadams/TallyArbiter/issues/new?assignees=JTF4&labels=bug&template=bug.yaml&title=%5BBug%5D%3A+) or open a [feature request](https://github.com/josephdadams/TallyArbiter/issues/new?assignees=JTF4&labels=feature&template=feature.yaml&title=%5BFeature+Request%5D%3A+), please go to our [issues](https://github.com/josephdadams/TallyArbiter/issues/new/choose) page.
If you would like to see more of @josephdadams's projects or send a word of encouragement his way, please visit [techministry.blog](https://techministry.blog/).

# Running the software

The software is written in Node.js and is therefore cross-platform and can be run on MacOS, Linux, or Windows.

**RUNNING DIRECTLY WITHIN NODE:**

1. Install Node.js if not already installed. <https://nodejs.org/en/download/> If installing on a Windows PC, ensure that the option to install Tools for Native Modules is selected otherwise the installation of Tally Arbiter Relay Listener will fail.
1. If installing on a Pi, run `sudo apt install libusb-1.0-0`: this shared library is necessary to communicate with the USB relay. `node-hid` ships prebuilt binaries for 64-bit ARM, so no compiler is needed.
1. Download the Tally Arbiter source code.
1. Open a terminal window and change directory to the folder where you placed the source code.
1. Type `npm install` to install all necessary libraries.
1. Type `node index.js` within the this folder. If you receive a permissions error, you may need to run the software as root, with `sudo node index.js`.
1. If this folder does not contain the `config_relays.json` file, an error will occur. A sample configuration file is provided.

**RUNNING AS A SERVICE (Raspberry Pi / Linux, with `systemd`):**

Use a 64-bit OS. Node.js 24 no longer publishes official 32-bit ARM (`armv7l`) builds, so on a 32-bit install you are capped at Node 22. The original Pi Zero and Zero W (armv6) can no longer run a supported version of Node at all -- the Pi Zero 2 W is the drop-in replacement.

First install Node.js 22 LTS or newer, plus the shared library used to talk to the relay:

```bash
sudo apt update
sudo apt install -y git libusb-1.0-0
```

Note the package name carefully: `libusb-1.0-0` ends in a dash and a zero, not `libusb-1.0.0`. It is often installed already, in which case `apt` will say so and do nothing.

(`libudev1` is also required, but it ships with `systemd` and is always present. `node-hid` bundles prebuilt binaries for 64-bit ARM inside its npm package, so no compiler is needed. Only if your platform has no matching prebuild and `npm install` falls back to building from source do you also need `sudo apt install libudev-dev libusb-1.0-0-dev build-essential`.)

Now get the code onto the Pi. The relay listener is one folder inside the main Tally Arbiter repository, so clone the repository, move that one folder to `/opt/tallyarbiter-relay`, and delete the rest:

```bash
git clone --depth 1 https://github.com/josephdadams/TallyArbiter.git ~/tallyarbiter-src
sudo mv ~/tallyarbiter-src/listener_clients/relay-listener /opt/tallyarbiter-relay
rm -rf ~/tallyarbiter-src
```

Then install the libraries it needs and create your configuration file:

```bash
cd /opt/tallyarbiter-relay
sudo npm ci
sudo cp config_relays.json.example config_relays.json
```

Edit `config_relays.json` to match your setup -- see [Configuration](#configuration) below.

Next, add a `udev` rule so the service can reach the relay without running as `root`:

```bash
sudo tee /etc/udev/rules.d/99-usbrelay.rules >/dev/null <<'EOF'
SUBSYSTEM=="usb", ATTRS{idVendor}=="16c0", ATTRS{idProduct}=="05df", MODE="0660", GROUP="plugdev"
KERNEL=="hidraw*", ATTRS{idVendor}=="16c0", ATTRS{idProduct}=="05df", MODE="0660", GROUP="plugdev"
EOF
sudo udevadm control --reload-rules && sudo udevadm trigger
```

Both lines are intentional. `node-hid` can be backed by either `libusb` or `hidraw`, and on Linux it defaults to `hidraw` -- so the `hidraw` rule is the one that does the work on a Pi, and the `usb` rule covers the other backend. Confirm your board's vendor and product IDs with `lsusb` -- the common dcttech/NOYITO boards report `16c0:05df`.

Create a user for the service and give it ownership of the folder:

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin tally
sudo usermod -aG plugdev tally
sudo chown -R tally:tally /opt/tallyarbiter-relay
```

Then create `/etc/systemd/system/tallyarbiter-relay.service`:

```ini
[Unit]
Description=Tally Arbiter Relay Listener
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=tally
Group=tally
SupplementaryGroups=plugdev
WorkingDirectory=/opt/tallyarbiter-relay
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
TimeoutStopSec=10
StandardOutput=journal
StandardError=journal
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

`WorkingDirectory` is required, not optional: the program reads `./config_relays.json` relative to the current directory, and writes a generated `clientUUID` back to it on first run. That folder must be writable by the service user, which is why `ProtectSystem` is set to `full` rather than `strict`.

Finally, enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tallyarbiter-relay
```

To view the console output, type `journalctl -u tallyarbiter-relay -f`.

On `systemctl stop` or `systemctl restart`, the listener turns off the relays it manages before exiting, so a tally light is never left lit by a restart.

Upon startup, the program will enumerate through the `config_relays.json` file and attempt to connect to the specified Tally Arbiter server.

# Relay Hardware

Tally Arbiter Relay Listener supports USB relays with up to 8 separate relays. If you need more relays, run the program on more devices. It is designed to run on a Raspberry Pi Zero 2 W for a low cost of entry.

The USB library is designed to work with these types of relays:
![picture alt](https://github.com/josephdadams/USBRelay/raw/master/usbrelay.jpg 'USB Relay')

# Configuration

The `config_relays.json` file contains two sections:

- `server_config`: The IP and Port of the Tally Arbiter server.

```javascript
 "server_config":
 {
	"ip": "192.168.11.141",
	"port": 4455
 }
```

- `relay_groups`: The groupings of relays that you want to control. Each Relay Group can be associated with one Tally Arbiter Device.

Example `relay_group` entry:

```javascript
{
	"id": 1,
	"relays": [
		{
			"relaySerial": "123456",
			"relayNumber": 1,
			"busType": "preview",
		},
		{
			"relaySerial": "123456",
			"relayNumber": 2,
			"busType": "program"
		}
	],
	"deviceId": "ed34bacd"
}
```

- `id`: A unique identifier.
- `relays`: The array of relays assciated in this group. It has the following properties:
  - `relaySerial`: The serial number of the relay board. This is required in case multiple boards are in use on the same device.
  - `relayNumber`: The actual relay number on the relay board. (1-8)
  - `busType`: Either `preview` or `program`.
- `deviceId`: If configured, the Tally Arbiter Device Id. If this Device Id is invalid or the property does not exist in your config file, Tally Arbiter will automatically reassign this relay group to the first Device on the server. You can reassign it to a new Device using the Tally Arbiter interface.

Each Relay Group will be represented as a listener client on the Tally Arbiter server.

Once your configuration file is created and you've made the physical connections to your contact closure devices, start up the Tally Arbiter Relay Listener and it will attempt to connect to the Tally Arbiter Server.

# Improvements and Suggestions

We are welcome to improvements and suggestions.
Feel free to contact us on Github Discussions or open a PR.
