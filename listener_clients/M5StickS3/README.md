# Tally Arbiter M5StickS3 Listener

Tally Arbiter M5StickS3 Listener is an accessory program that allows you to connect to a Tally Arbiter server and control an M5StickS3 ESP32-S3 device from M5Stack based on the incoming tally information.
To learn more about the Tally Arbiter project, [click here](http://github.com/josephdadams/tallyarbiter).

It is not sold, authorized, or associated with any other company or product.

To [report a bug](https://github.com/josephdadams/TallyArbiter/issues/new?assignees=JTF4&labels=bug&template=bug.yaml&title=%5BBug%5D%3A+) or open a [feature request](https://github.com/josephdadams/TallyArbiter/issues/new?assignees=JTF4&labels=feature&template=feature.yaml&title=%5BFeature+Request%5D%3A+), please go to our [issues](https://github.com/josephdadams/TallyArbiter/issues/new/choose) page.
If you would like to see more of @josephdadams's projects or send a word of encouragement his way, please visit [techministry.blog](https://techministry.blog/).

You can buy an M5Stick here:
https://shop.m5stack.com/collections/stick-series

# Installation

## Using the Arduino IDE

There is currently no pre-built firmware for the M5StickS3, so it must be built from source. (The other listeners publish build artifacts from GitHub Actions; a build job for this board has not been added yet.)

1. Go to https://docs.m5stack.com/en/arduino/arduino_board and follow the instructions under the "Boards Manager" heading to add the M5Stack board index. You need **M5Stack Arduino 3.3.8 or newer**, which is the first version that includes the M5StickS3 board definition.
2. Open `M5StickS3.ino` in the Arduino IDE.
3. In Library Manager install:
   - **M5Unified** (0.2.12 or newer)
   - **M5GFX** (0.2.18 or newer)
   - **WebSockets** by Markus Sattler
   - **Arduino_JSON**
   - **WiFiManager** by tzapu
4. Plug your board into the computer.
5. Select **M5Stack -> M5StickS3** under Tools -> Board.
6. In the IDE go to Sketch -> Upload.
   Make sure you have selected the **right serial port** and the **right board type**.

Done! Now your board is running the listener client firmware. Go to the _"Setup your device"_ section to connect the board to the Tally Arbiter server.

You can monitor your device's status via the Serial Monitor: set speed to 115200.

**NB:** Do not add the legacy `Free_Fonts.h` header used by the older M5StickC listener. M5GFX supplies the fonts on this board.

# Setup your device

1. Plug the device in a power source.
2. Wait for the boot up to finish. If there is no saved AP it will start up an Access Point where you can configure one.
3. Connect to the `m5StickS3-XXXXXX` Access Point via phone and go to 192.168.4.1 (or wait a bit, a captive portal page should open).
4. Set your Tally Arbiter server IP and port by going to the _"Setup"_ page. The defaults are `192.168.1.99` and port `4455`.
5. Go back, then go to the "Configure WiFi" page and set your WiFi credentials. The board should reboot.
6. If the connection is successful a settings page will be shown. If not, reconnect to the `m5StickS3-XXXXXX` Access Point.

Button A (M5):
Single click - Switch between the settings screen and the device name (the device name comes from the Tally Arbiter server).
Long press 5 seconds - Erase the saved WiFi credentials and restart.

Button B:
Single click - Cycle screen brightness. Brightness steps up from 80 to 255 and then wraps back around to 80.

Once connected, the device can be reassigned to a different Device from the Tally Arbiter settings page, and it responds to the Flash button by blinking the screen white. Reassignments are saved to the device so they survive a reboot.

Over-the-air updates are enabled once the device is on your network, using the hostname shown on the settings screen.

# Troubleshooting

### The device connects but never shows tally

Confirm the server address and port on the settings screen, and check that the Device the listener is assigned to actually has a source feeding it. The listener appears in the Tally Arbiter settings page under Listener Clients once it has registered.

### macOS build error

If you receive an error similar to `ImportError: No module named serial` reference: https://community.m5stack.com/post/11106

# Improvements and Suggestions

We are welcome to improvements and suggestions.
Feel free to contact us on Github Discussions or open a PR.
