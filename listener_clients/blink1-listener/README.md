# Tally Arbiter Blink(1) Listener

Tally Arbiter Blink(1) Listener was written by Joseph Adams and is distributed under the MIT License.

Tally Arbiter Blink(1) Listener is an accessory program that allows you to connect to a Tally Arbiter server and control blink(1) devices (by Thingm) based on the incoming tally information.

It is written in Python and designed to run on a Pi Zero with minimal configuration needed. It uses the `python-socketio[client]` library to communicate with the Tally Arbiter server.

To learn more about the Tally Arbiter project, [click here](http://github.com/josephdadams/tallyarbiter).

It is not sold, authorized, or associated with any other company or product.

You can buy a Blink(1) here:
[Amazon (US)](https://www.amazon.com/ThingM-Blink-USB-RGB-BLINK1MK3/dp/B07Q8944QK/ref=sr_1_1?keywords=blink+1&qid=1637449295&sr=8-1),
[getDigital.de (EU)](https://www.getdigital.de/blink-1-mk2.html),
[Seeed Studio (China)](https://www.seeedstudio.com/Blink-1-mk2-p-2367.html).

To [report a bug](https://github.com/josephdadams/TallyArbiter/issues/new?assignees=JTF4&labels=bug&template=bug.yaml&title=%5BBug%5D%3A+) or open a [feature request](https://github.com/josephdadams/TallyArbiter/issues/new?assignees=JTF4&labels=feature&template=feature.yaml&title=%5BFeature+Request%5D%3A+), please go to our [issues](https://github.com/josephdadams/TallyArbiter/issues/new/choose) page.
If you would like to see more of @josephdadams's projects or send a word of encouragement his way, please visit [techministry.blog](https://techministry.blog/).

## Getting Started

A lot of these instructions on getting started are available all over the internet. Some highlights are listed here that should cover it from a top-level:

1. The Raspberry Pi OS Lite version is sufficient for this use. You can download it here: https://www.raspberrypi.org/downloads/raspbian/
1. Use Balena Etcher to write the image to your microSD card: https://www.balena.io/etcher/
1. Once the image is written, mount the card to your computer and enable SSH by adding a blank file named `SSH` to the root of the `boot` volume oef the card. If you're using MacOS, an easy way to do this is to open Terminal, type `cd /Volumes/boot` and then `touch ssh`. This will create an empty file. You do not need to put anything in the file, it just needs to exist.
1. Add another file to the root of the `boot` volume named `wpa_supplicant.conf`. Again, in terminal, just type `touch wpa_supplicant.conf` while you're in the root of the `boot` volume and it will be created.
1. The new `wpa_supplicant.conf` file needs to be edited. Use `sudo nano wpa_supplicant.conf`. This file should contain the following:

   ```
   ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
   update_config=1
   country=US

   network={
   	ssid="Your network name/SSID"
   	psk="Your WPA/WPA2 security key"
   	key_mgmt=WPA-PSK
   }
   ```

   Edit `country=`, `ssid=` and `psk=` with your information and save the file by pressing `CTRL + X`.

1. At this point, you can eject the card and put into the Pi and turn it on.
1. Now you can SSH into the Pi to continue configuration. You'll need the IP address of the Pi. You can usually get this in your router admin page, or you might need to do more depending on your network.
1. In the terminal window, type `ssh pi@192.168.1.5` (replace with your actual Pi IP address). It will prompt for a password. The default is usually `raspberry`.
1. Once you're connected to the Pi via SSH, it's a good idea to go ahead and change the default password. You can do this by running the `sudo raspi-config` tool, Option 1. Reboot the Pi when you're done by using `sudo shutdown -r now`. Your connection to the Pi will be terminated and you can reconnect once it has booted back up.
1. Go ahead and update the Pi to the latest OS updates by running `sudo apt-get update -y` followed by `sudo apt-get upgrade -y`

## Installing Python Libraries and Script

The Tally Arbiter Python Listener Client uses the following libraries:

- `blink1`
- `python-socketio[client]`
- `zeroconf`

These will have to be installed on the Pi in order for the script to function correctly.

1. In your SSH terminal session, run the following:

   - `sudo apt install libudev-dev libusb-1.0-0-dev`: The `libusb` library is necessary to communicate with the blink(1) device over USB.
   - `sudo pip3 install blink1`: This is the base library to use with the blink(1).
   - `sudo pip3 install "python-socketio[client]<5"`: This library is used to communicate with a Tally Arbiter server over websockets.
   - `sudo pip3 install zeroconf`: This library helps with auto discovery of services

   _If `pip3` is not installed, you can get it by running `sudo apt-get install python3-pip`._

1. Now that all the necessary libraries are installed and compiled, you need to copy the `tallyarbiter-blink1listener.py` file to your Pi. You can do this a number of ways, but one simple way is to execute this command through your SSH connection: `wget https://raw.githubusercontent.com/josephdadams/TallyArbiter/master/listener_clients/blink1-listener/blink1-listener.py`. This will copy the file into your current folder (you should still be the home folder for the `pi` account).
1. Once the Python script has been copied over, go ahead and test it out to make sure everything is working properly. Run this in the SSH session: `sudo python3 tallyarbiter-blink1listener.py 192.168.1.6 4455`

   Be sure to replace the IP address `192.168.1.6` with the IP of your Tally Arbiter server. If you leave off the port, it will attempt to connect using port `4455`.

1. If it is working properly, the blink(1) will flash green twice as it connects to the server. You can also view the newly added listener client in the Tally Arbiter Settings page. Use the "flash" button if you want to see the server communicate with the listener client.

## Setting up the script to start at boot

Now that it is working properly, you will want to set up the script to run on boot so that all you have to do is turn on the Pi and wait for it to launch and connect to the server. There are several different methods in the Raspberry Pi OS to do this. The following describes how to do it using the `rc.local` file.

1. In your SSH session, type `sudo nano /etc/rc.local`.
1. Just before the last line of this file (`exit 0`), add the following: `sudo python3 /home/pi/tallyarbiter-blink1listener.py 192.168.1.6 4455 &`. The `&` is important because it allows the script to launch in a separate thread since we want the program to continue running in the background.
1. Now reboot the Pi to test that the script runs on boot: `sudo reboot`. This will end your SSH session.

The program should now launch every time the Pi boots up, and automatically connect to your Tally Arbiter server once the server is available. The blink(1) device will flash white until it successfully connects to the server.

# Improvements and Suggestions

We are welcome to improvements and suggestions.
Feel free to contact us on Github Discussions or open a PR.
