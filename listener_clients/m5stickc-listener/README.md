# Tally Arbiter M5Stick-C Listener
Tally Arbiter M5Stick-C Listener was written  by Joseph Adams and is distributed under the MIT License.

Tally Arbiter M5Stick-C Listener is an accessory program that allows you to connect to a Tally Arbiter server and control an M5Stick-C ESP32 Arduino device from M5Stack based on the incoming tally information.

To learn more about the Tally Arbiter project, [click here](http://github.com/josephdadams/tallyarbiter).

It is not sold, authorized, or associated with any other company or product.

To contact the author or for more information, please visit [www.techministry.blog](http://www.techministry.blog).

## Installing Sketch and Libraries
1. Follow the [tutorial on the M5Stack website](https://docs.m5stack.com/#/en/arduino/arduino_development) to download, install, and configure the Arduino IDE program. This is necessary to compile the code for your device.
1. Once you have the Arduino IDE installed and configured for your OS, install the following libraries (if not already installed):
	* `M5StickC` / `M5StickCPlus` (depending on the device you are using)
	* `WebSockets` by Markus Sattler
	* `Arduino_JSON` by Arduino
	* `MultiButton` by Martin Poelstra

These will have to be included with the sketch file in order for it to compile properly.
## Compile and Upload the Sketch to the Device
1. Once all libraries are downloaded, open the `tallyarbiter-m5stickc.ino` file in the Arduino IDE.
1. Modify these lines at the top of the file to reflect your wireless network and Tally Arbiter server settings:
	```c++
	//Wifi SSID and password
	const char * networkSSID = "YourNetwork";
	const char * networkPass = "YourPassword";

	//Tally Arbiter Server
	const char * tallyarbiter_host = "192.168.1.100";
	const int tallyarbiter_port = 4455;
	```
1. Save the file.
1. Connect your M5Stick-C device to the computer via the provided USB-C cable.
1. If not already on, power the device on by holding down the power button (located on the bottom left-hand side) for a couple seconds.
1. Go to Tools > Board > ESP32 Arduino > and choose `M5Stick-C`. If it's not listed, you may need to install it through the Boards Manager.
1. Go to Tools > Upload Speed > and choose `750000` (one less from the maximum speed).
1. Go to Tools > Port > and choose the serial port that represents your device.
1. Go to Sketch > and choose `Upload`. The code will compile and upload to the device.

Once the code is successfully compiled and uploaded to the device. the M5Stick-C will boot up and automatically try to connect to your Tally Arbiter server. It will auto-assign itself to the first Device on the server, and you can reassign it through the Settings GUI of Tally Arbiter.

Video Walkthrough: https://youtu.be/WMrRKD63Jrw

## Using the Device
When you turn on the M5Stick-C device after it has been programmed, it will automatically connect to the wireless network using the settings provided, and then initiate a connection to the Tally Arbiter server. If the server is offline, just reboot the device after the server is back online.

If you press the `M5` button on the device, you can toggle between the tally window display and the Settings window, which shows the IP address and Tally Arbiter server information as well as the current battery level of the device.

If you press the `action` button on the right side of the device, you can adjust the brightness.

Other features using various button combinations may be added at a later date with an upgrade to this code.

# Improvements and Suggestions
I welcome all improvements and suggestions. You can submit issues and pull requests, or contact me through [my blog](http://www.techministry.blog).

## Thanks
Thank you to [Guido Visser](https://github.com/guido-visser), inspiration for this listener client came from his project, [vMix M5Stick-C Tally Light](https://github.com/guido-visser/vMix-M5Stick-Tally-Light).