# Tally Arbiter ESP32-S3 AtomS3 Lite Listener

Tally Arbiter ESP32-S3 AtomS3 Lite Listener is an accessory program that allows you to connect to a Tally Arbiter server and control an M5Stack AtomS3 Lite device based on the incoming tally information.
To learn more about the Tally Arbiter project, [click here](http://github.com/josephdadams/tallyarbiter).

It is not sold, authorized, or associated with any other company or product.

To [report a bug](https://github.com/josephdadams/TallyArbiter/issues/new?assignees=JTF4&labels=bug&template=bug.yaml&title=%5BBug%5D%3A+) or open a [feature request](https://github.com/josephdadams/TallyArbiter/issues/new?assignees=JTF4&labels=feature&template=feature.yaml&title=%5BFeature+Request%5D%3A+), please go to our [issues](https://github.com/josephdadams/TallyArbiter/issues/new/choose) page.
If you would like to see more of @josephdadams's projects or send a word of encouragement his way, please visit [techministry.blog](https://techministry.blog/).

You can buy an M5Stack AtomS3 Lite here:
https://docs.m5stack.com/en/core/AtomS3-lite

# Installation

## 1. Using a pre-built version

1. Download an ESP flasher.
   You can use [esphome-flasher](https://github.com/esphome/esphome-flasher). If you want to use it, go to the [Github page](https://github.com/esphome/esphome-flasher) and download the latest release.
2. Go to https://github.com/josephdadams/TallyArbiter/actions/workflows/build-listener-clients.yaml and click on the first element in the list.
   From here, scroll down to the _"Artifacts"_ section and click on _"TallyArbiter-Listener-ESP32-S3-AtomS3-Lite"_.
   Un-zip the downloaded archive.
3. Plug your board into the computer.
4. Open the ESP flasher that you downloaded.
   Select the **right serial port** _(from the "Serial port" list in esphome-flasher)_ and import the device firmware _(clicking on "Browse" in esphome-flasher)_.
   You should select the file that ends in **.ino.bin**, not the file that ends in _.ino.elf_ or _.ino.partitions.bin_.
5. Flash the firmware on your board _(clicking "Flash ESP" in esphome-flasher)_.

Done! Now your board is running the latest listener client firmware version. Go to the _"Setup your device"_ sections to connect the board to the Tally Arbiter server.

## 2. Using the Arduino IDE

1. Go to https://docs.m5stack.com/en/arduino/arduino_development follow the instructions under heading "Boards Manager"
2. Select the board: **Tools > Board > M5Stack Arduino > M5Stack AtomS3 Lite**
3. **IMPORTANT: Change Partition Scheme** - Go to **Tools > Partition Scheme** and select **"Huge APP (3MB No OTA/1MB SPIFFS)"** or **"No OTA (2MB APP/2MB SPIFFS)"**. This is necessary because the default partition scheme only allocates ~1.3MB for the application, which is not enough for this sketch. The AtomS3 Lite has 8MB flash, so we need to allocate more space for the app partition.
4. **Set Compiler Optimization** - Go to **Tools > Core Debug Level** and select **"None"** or **"Error"** to reduce compiled size. Also check **Tools > Optimize** and select **"Optimize for size (-Os)"** if available.
5. Open `esp32-s3-atoms3-lite-listener.ino` in Arduino IDE
6. In Library Manager install the following libraries:
   - **M5AtomS3** (by M5Stack)
   - **FastLED** (by Daniel Garcia)
   - **SocketIOclient** (by links2004)
   - **Arduino_JSON** (by Arduino)
   - **WebSockets** version 2.3.4 (by Markus Sattler)
   - **WiFiManager** (by tzapu)
   - **ArduinoOTA** (usually included with ESP32 board support)
7. Plug your board into the computer.
8. In the IDE go to Sketch -> Upload.
   Make sure you have selected the **right serial port** and the **right board type**.

**Note:** If you select a partition scheme without OTA, the Over-The-Air update functionality will be disabled. If you need OTA, try "Default 4MB with spiffs" or "Minimal SPIFFS (1.9MB APP with OTA/190KB SPIFFS)" which should still provide enough space.

Done! Now your board is running the latest listener client firmware version. Go to the _"Setup your device"_ section to connect the board to the Tally Arbiter server.

# Setup your device

1. Plug the device in a power source
2. Wait for the boot sequence to finish, if there is no saved WiFi network it will start an Access Point where you can configure one.
3. Connect to the 'atomS3Lite-XXXXXX' Access Point via phone or computer and go to 192.168.4.1 (or wait a bit, a captive portal page should open). NB: The portal times out after 120 sec of inactivity.
4. Set your Tally Arbiter server IP and port by going to _"Configure WiFi"_ page and scrolling down to the custom parameters.
5. Set your WiFi credentials in the same page. The board should reboot.
6. If the connection is successful, the RGB LED will briefly flash green. If not, the LED will show red and you can reboot the device to try again.

Button:
- Single press - Toggle configuration portal on/off. When the portal is active, the LED turns purple to indicate you can access the configuration page at the device's IP address (e.g., http://192.168.1.100). You can change WiFi settings, Tally Arbiter server IP/port, and other parameters without disconnecting from your network.
- Long press (5 seconds) - Reset WiFi credentials and restart

# Features

- **WiFi Station Mode**: Connects to your primary wireless network
- **RGB LED Display**: 
  - Onboard RGB LED shows tally status with colors from Tally Arbiter
  - Optional external RGB LED support that mirrors the onboard LED (configurable via `EXTERNAL_LED_PIN` in code)
- **WiFi Configuration Portal**: Web-based configuration interface accessible:
  - Automatically when device creates its own Access Point (first-time setup)
  - On-demand by pressing the button while connected to WiFi (LED turns purple)
  - Access at the device's IP address (e.g., http://192.168.1.100)
  - Can change WiFi settings and Tally Arbiter server configuration without disconnecting
- **Over-the-Air Updates**: Supports OTA firmware updates (if partition scheme allows)
- **Persistent Storage**: Saves device ID, device name, and server settings to non-volatile memory

# Troubleshooting

### macOS build error

If you receive an error similar to `ImportError: No module named serial` reference: https://community.m5stack.com/post/11106

### Board not found in Arduino IDE

Make sure you have installed the M5Stack board support package and selected the correct board from **Tools > Board > M5Stack Arduino > M5Stack AtomS3 Lite**.

### Sketch too big error / text section exceeds available space

If you get an error saying the sketch is too big:
1. **Change the Partition Scheme**: Go to **Tools > Partition Scheme** and select a scheme with more app space:
   - **"Huge APP (3MB No OTA/1MB SPIFFS)"** - Best for size, but disables OTA
   - **"No OTA (2MB APP/2MB SPIFFS)"** - Good balance, disables OTA
   - **"Minimal SPIFFS (1.9MB APP with OTA/190KB SPIFFS)"** - Enables OTA but might be tight
2. **Enable compiler optimizations**: Go to **Tools > Core Debug Level** and select **"None"** to reduce debug output
3. **Check Flash Size**: Make sure **Tools > Flash Size** is set to **"8MB"** (it should detect this automatically)

### LED not working

- Verify the M5AtomS3 library is installed correctly
- Check that the board type is correctly selected in Arduino IDE
- The RGB LED should turn blue during initialization

### WiFi connection issues

- Hold the button for 5 seconds to reset WiFi credentials
- The device will create an Access Point named 'atomS3Lite-XXXXXX' if it cannot connect to a saved network
- Check that your WiFi network is 2.4GHz (ESP32-S3 does not support 5GHz)

### External LED Configuration

To connect an external RGB LED (WS2812B/NeoPixel) that mirrors the onboard LED:

1. Connect the external LED:
   - **VCC/5V** to 5V power source (ensure adequate current for your LED)
   - **GND** to GND
   - **Data** to any available GPIO pin (e.g., GPIO 2, 4, 5, etc.)

2. Edit `esp32-s3-atoms3-lite-listener.ino`:
   - Change `#define EXTERNAL_LED_PIN -1` to your GPIO pin number (e.g., `#define EXTERNAL_LED_PIN 2`)
   - If using a strip with multiple LEDs, adjust `#define EXTERNAL_NUM_LEDS 1` to match

3. Recompile and upload

The external LED will automatically mirror all states of the onboard LED (tally colors, configuration portal indicator, flash commands, etc.). Set `EXTERNAL_LED_PIN` to `-1` to disable.

# Improvements and Suggestions

We are welcome to improvements and suggestions.
Feel free to contact us on Github Discussions or open a PR.
