# ESP32 NeoPixel Listener (ESP32 C3 version)

Tally Arbiter ESP32 C3 NeoPixel Listener is an accessory program that allows you to connect to a Tally Arbiter server and control a NeoPixel device based on the incoming tally information. This listener version had been tested with the widely available ESP-C3-32S devkit with a built-in RGB led. You may need to adjust some parameters for other ESP32 C3 models.

To learn more about the Tally Arbiter project, [click here](http://github.com/josephdadams/tallyarbiter).

It is not sold, authorized, or associated with any other company or product.

To [report a bug](https://github.com/josephdadams/TallyArbiter/issues/new?assignees=JTF4&labels=bug&template=bug.yaml&title=%5BBug%5D%3A+) or open a [feature request](https://github.com/josephdadams/TallyArbiter/issues/new?assignees=JTF4&labels=feature&template=feature.yaml&title=%5BFeature+Request%5D%3A+), please go to our [issues](https://github.com/josephdadams/TallyArbiter/issues/new/choose) page.
If you would like to see more of @josephdadams's projects or send a word of encouragement his way, please visit [techministry.blog](https://techministry.blog/).

You can buy an NeoPixel here:
https://shop.m5stack.com/collections/stick-series/products/m5stickc-neofalsh-hat

# Installation

## Using the Arduino IDE (checked with 2.3.6)

1. Go to https://docs.m5stack.com/en/arduino/arduino_development follow the instructions under heading "Boards Manager"
2. Open esp32_c3_neopixel_listener.ino in Arduino IDE
3. In Library Manager install Arduino_JSON, Adafruit Neopixel, WebSockets (by Markus Sattler), and WifiManager (by tzapu)
4. Plug your board into the computer
5. In the IDE go to Sketch -> Upload
   Make sure you have selected the **right serial port** and the **right board type** (ESP32C3 dev module).

Done! Now your board is running the latest listener client firmware version. Go to the _"Setup your device"_ sections to connect the board to the Tally Arbiter server.

You can monitor your ESP32's status via the Serial Monitor: set speed to 115 200.

# Setup your device

1. Plug the device in a power source
2. Wait for the boot animation to finish, if there is no saved AP it will startup an Access Point where you can configure one.
3. Connect to the 'neopixel-xxxxxxxx' Access Point via phone and go to 192.168.4.1 (or wait a bit, a captive portal page should open).
4. Set your Tally Arbiter server ip by going to _"Setup"_ page.
5. Go back, then go to the "Configure WiFi" page and set your WiFi credentials. The board should reboot.
6. If the connection is successful a WiFi animation and a green tick mark will show. If not a red cross will be shown and you can reboot the device to try again.

## Soldering (Optional)

The NeoPixel-LEDs need to be soldered (or connected via cables) to the ESP32-board for them to light up. GND must connect to GND on the ESP32 board, +5V to +5V or VCC and DIN to the LED_PIN defined in the code (0 by default).

# Troubleshooting

### macOS build error

If you receive an error similar to `ImportError: No module named serial` reference: https://community.m5stack.com/post/11106

# Videos

- What this does when used with TallyArbiter - https://youtu.be/hNhU22OkXek
- RAW Step-By-Step Install on a fresh windows installation (warning: this video is outdated) - https://youtu.be/soj1Cxv3mLY
- Video Walkthrough (warning: this video is outdated) - https://youtu.be/WMrRKD63Jrw

# Improvements and Suggestions

We are welcome to improvements and suggestions.
Feel free to contact us on Github Discussions or open a PR.
