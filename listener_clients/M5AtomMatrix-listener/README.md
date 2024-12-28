# Tally Arbiter M5 ATOM Matrix Listener

Tally Arbiter M5 ATOM Matrix Listener is an accessory program that allows you to connect to a Tally Arbiter server and control an M5Stick-C ESP32 Arduino device from M5Stack based on the incoming tally information.
To learn more about the Tally Arbiter project, [click here](http://github.com/josephdadams/tallyarbiter).

It is not sold, authorized, or associated with any other company or product.

To [report a bug](https://github.com/josephdadams/TallyArbiter/issues/new?assignees=JTF4&labels=bug&template=bug.yaml&title=%5BBug%5D%3A+) or open a [feature request](https://github.com/josephdadams/TallyArbiter/issues/new?assignees=JTF4&labels=feature&template=feature.yaml&title=%5BFeature+Request%5D%3A+), please go to our [issues](https://github.com/josephdadams/TallyArbiter/issues/new/choose) page.
If you would like to see more of @josephdadams's projects or send a word of encouragement his way, please visit [techministry.blog](https://techministry.blog/).

You can buy an M5 ATOM Matrix here:
https://m5stack.com/collections/m5-atom/products/atom-matrix-esp32-development-kit
OR
https://www.adafruit.com/product/4497 (Shipped from USA)

# Installation

## 1. Using a pre-built version

1. Download an ESP flasher.
   You can use [esphome-flasher](https://github.com/esphome/esphome-flasher). If you want to use it, go to the [Github page](https://github.com/esphome/esphome-flasher) and download the latest release.
2. Go to https://github.com/josephdadams/TallyArbiter/actions/workflows/build-listener-clients.yaml and click on the first element in the list.
   From here, scroll down to the _"Artifacts"_ section and click on _"TallyArbiter-Listener-M5Atom"_.
   Un-zip the downloaded archive.
3. Plug your board into the computer.
4. Open the ESP flashed that you downloaded.
   Select the **right serial port** _(from the "Serial port" list in esphome-flasher)_ and import the device firmware _(clicking on "Browse" in esphome-flasher)_.
   You should select the file that ends in **.ino.bin**, not the file that ends in _.ino.elf_ or _.ino.partitions.bin_.
5. Flash the firmware on your board _(clicking "Flash ESP" in esphome-flasher)_.

Done! Now your board is running the latest listener client firmware version. Go to the _"Setup your device"_ sections to connect the board to the Tally Arbiter server.

## 2. Using the Arduino IDE

1. Go to https://docs.m5stack.com/en/arduino/arduino_development follow the instructions under heading "Boards Manager"
2. Open tallyarbiter-m5atom.ino in Arduino IDE
3. In Library Manager install FastLED, SocketIoClient, Arduino_JSON, WebSockets version 2.3.4, WifiManager (by tzapu) and MultiButton
4. Plug your board into the computer.
5. In the IDE go to Sketch -> Upload.
   Make sure you have selected the **right serial port** and the **right board type**.

Done! Now your board is running the latest listener client firmware version. Go to the _"Setup your device"_ section to connect the board to the Tally Arbiter server.

# Setup your device

1. Plug the device in a power source
2. Wait for the boot animation to finish, if there is no saved AP it will start an Access Point where you can configure one.
3. Connect to the 'm5Atom-XXXXXX' Access Point via phone and go to 192.168.4.1 (or wait a bit, a captive portal page should open). NB: The portal times out after 120 sec of inactivity.
4. Set your Tally Arbiter server ip by going to _"Setup"_ page.
5. Go back, then go to the "Configure WiFi" page and set your WiFi credentials. The board should reboot.
6. If the connection is successful a WiFi animation and a green tick mark will show. If not a red cross will be shown and you can reboot the device to try again.

Button (behind screen):
Single click - Toggle between camera number 1 to 16.
Long press 5 seconds - reset WiFi credentials.

# Troubleshooting

### macOS build error

If you receive an error similar to `ImportError: No module named serial` reference: https://community.m5stack.com/post/11106

# Videos

- What this does when used with TallyArbiter - https://youtu.be/hNhU22OkXek
- Demo of the M5Atom Matrix code in this git - https://youtu.be/Mc_PCxg6qdc
- Demo running on 10 M5Atom Matrix units via a cloud server - https://youtu.be/TiqjmXdzPic
- RAW Step-By-Step Install on a fresh windows installation - UPDATED 2024/04/26- https://youtu.be/soj1Cxv3mLY
- Video Walkthrough (warning: this video is outdated) - https://youtu.be/WMrRKD63Jrw

# Improvements and Suggestions

We are welcome to improvements and suggestions.
Feel free to contact us on Github Discussions or open a PR.
