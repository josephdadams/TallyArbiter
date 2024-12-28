# Tally Arbiter Pimoroni Blinkt! Listener

Tally Arbiter Pimoroni Blinkt! Listener was written by Joseph Adams and is distributed under the MIT License.

Tally Arbiter Pimoroni Blinkt! Listener is an accessory program that allows you to connect to a Tally Arbiter server and control blinkt! devices (by Pimoroni) connected to a Raspberry Pi based on the incoming tally information.

It is written in Python and designed to run on a Pi Zero with minimal configuration needed. It uses the `python-socketio[client]` library to communicate with the Tally Arbiter server.

To learn more about the Tally Arbiter project, [click here](http://github.com/josephdadams/tallyarbiter).

It is not sold, authorized, or associated with any other company or product.

You can buy a Pimoroni Blinkt! here:
https://shop.pimoroni.com/products/blinkt
OR
https://www.adafruit.com/product/3195 (Shipped from USA)

To open a bug report or feature request, please visit [the TallyArbiter GitHub repo](https://github.com/josephdadams/TallyArbiter/issues/new/choose).

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

- `blinkt`
- `python-socketio[client]`
- `zeroconf`
- `requests`

These will have to be installed on the Pi in order for the script to function correctly.

1. In your SSH terminal session, run the following:

   - `curl https://get.pimoroni.com/blinkt | bash`L This library is used to communicate with a blinkt! device connected to the GPIO pins.
   - `sudo pip3 install "python-socketio[client]<5"`: This library is used to communicate with a Tally Arbiter server over websockets.
   - `sudo pip3 install zeroconf`: This library is used to capture command line arguments and reference them as variables.
   - `sudo pip3 install requests`: This library is used to handle the initial communication with the TallyArbiter server

   _If `pip3` is not installed, you can get it by running `sudo apt-get install python3-pip`._

1. Now that all the necessary libraries are installed and compiled, you need to copy the `tallyarbiter-pimoroni-blinkt-listener.py` file to your Pi. You can do this a number of ways, but one simple way is to execute this command through your SSH connection: `wget https://raw.githubusercontent.com/josephdadams/TallyArbiter/master/listener_clients/pimoroni-blinkt-listener/pimoroni-blinkt-listener.py`. This will copy the file into your current folder (you should still be the home folder for the `pi` account).
1. Once the Python script has been copied over, go ahead and test it out to make sure everything is working properly. Run this in the SSH session: `sudo python3 tallyarbiter-pimoroni-blinkt-listener.py --host 192.168.1.6 --port 4455`

   Be sure to replace the IP address `192.168.1.6` with the IP of your Tally Arbiter server. If you leave off the port, it will attempt to connect using port `4455`.

1. If it is working properly, the blinkt! will flash green twice as it connects to the server. You can also view the newly added listener client in the Tally Arbiter Settings page. Use the "flash" button if you want to see the server communicate with the listener client.

## Setting up the script to start at boot

Now that it is working properly, you will want to set up the script to run on boot so that all you have to do is turn on the Pi and wait for it to launch and connect to the server. There are several different methods in the Raspberry Pi OS to do this. The following describes how to do it using the `rc.local` file.

1. In your SSH session, type `sudo nano /etc/rc.local`.
1. Just before the last line of this file (`exit 0`), add the following: `sudo python3 /home/pi/tallyarbiter-pimoroni-blinkt-listener.py --host 192.168.1.6 --port 4455 &`. The `&` is important because it allows the script to launch in a separate thread since we want the program to continue running in the background.
1. Now reboot the Pi to test that the script runs on boot: `sudo reboot`. This will end your SSH session.

The program should now launch every time the Pi boots up, and automatically connect to your Tally Arbiter server once the server is available. The blinkt! device will flash white until it successfully connects to the server.

# Improvements and Suggestions

We are welcome to improvements and suggestions.
You can submit issues and pull requests on this repo.
