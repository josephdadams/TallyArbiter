---
sidebar_position: 3
---

# Remote Tally Viewing (Listener Clients)

In addition to the multiple output action types that can be used to trigger any number of remote devices for a tally state, Tally Arbiter also supports "listener clients": devices and software that open websocket connections to the Tally Arbiter server and can receive data in real time to utilize tally information.

All connected listener clients are tracked and listed in the Settings page. You can "flash" a particular listener by clicking the Flash button next to it in the list. This is useful if you need to get the operator's attention or determine which listener is which. You can also reassign the listener to receive tally information of another Device at any time using the Tally Arbiter interface.

## Using a web page for tally output

Navigate to `/tally` on the Tally Arbiter server in your browser and select a Device from the list. As long as the page remains connected to the system, it will display tally data (Preview, Program, Preview+Program, Clear) in real time. Web clients can also send/receive messages with the Producer, like a chat room.

**You can also go to `/#/tally/9fe2efd9a` (replace `9fe2efd9a` with your actual DeviceId) and auto load the page to that Device without having to choose it from the list.**

If you include `?chat=false` to the request, you can turn off the Messaging/Chat functions.

## Viewing all tally data

Navigate to `/producer` on the Tally Arbiter server in your browser to view all Devices and their current states. This information is also available in the Settings GUI but is displayed in a minimal fashion here for in-service viewing. Messages can be sent and received to supported clients.
**This page is restricted by a username and password. The default username is `producer` and the default password is `12345`.**

## Using an M5StickC for tally output

Tally Arbiter can send tally data to an M5StickC Arduino Finger Computer. A remote script is available here, [Tally Arbiter M5StickC Listener](https://github.com/josephdadams/TallyArbiter/tree/master/listener_clients/m5stickc-listener). For installation and use instructions, please check out that repository's [readme](https://github.com/josephdadams/TallyArbiter/blob/master/listener_clients/m5stickc-listener/README.md).

## Using an ESP32 board with NeoPixel LEDs

You can use Tally Arbiter with generic ESP32 boards as well with this separate script: [Tally Arbiter ESP32 Listener](https://github.com/josephdadams/TallyArbiter/tree/master/listener_clients/esp32-neopixel-listener). For installation and instructions, please check out that repository's [readme](https://github.com/josephdadams/TallyArbiter/blob/master/listener_clients/esp32-neopixel-listener/README.md).

## Using an M5 Atom Matrix for tally output

Tally Arbiter can send tally data to an M5 Atom Matrix. A remote script is available in the separate repository, [Tally Arbiter M5 Atom Matrix Listener](https://github.com/josephdadams/TallyArbiter/tree/master/listener_clients/M5AtomMatrix-listener). For installation and use instructions, please check out that repository's [readme](https://github.com/josephdadams/TallyArbiter/blob/master/listener_clients/M5AtomMatrix-listener/README.md).

## Using a blink(1) for tally output

Tally Arbiter supports the use of a USB blink(1) device as a tally light. A remote listening script is available in the separate repository, [Tally Arbiter Blink1 Listener](https://github.com/josephdadams/TallyArbiter/tree/master/listener_clients/blink1-listener). For installation and use instructions, please check out that repository's [readme](https://github.com/josephdadams/TallyArbiter/blob/master/listener_clients/blink1-listener/README.md). It is compatible with and was designed to run on a Raspberry Pi Zero, making this an inexpensive option for _wireless_ tally output. However, it can be run on any OS/device that supports Python such as MacOS or Windows, which can be helpful if you want to use this with graphics or video playback operators, for example.

## Using a Pimoroni Blinkt! for tally output

Tally Arbiter supports the use of Pimoroni Blinkt! lights connected to a Raspberry Pi via the GPIO pins. A remote listening script is available in the separate repository, [Tally Arbiter Pimoroni Blinkt! Listener](https://github.com/josephdadams/TallyArbiter/tree/master/listener_clients/pimoroni-blinkt-listener). For installation and use instructions, please check out that repository's [readme](https://github.com/josephdadams/TallyArbiter/blob/master/listener_clients/pimoroni-blinkt-listener/README.md).

## Using a Relay for contact-closure systems

Many Camera CCUs and other devices support incoming tally via contact closure. A remote listening script that can trigger USB relays is available with the separate repository, [Tally Arbiter Relay Listener](https://github.com/josephdadams/TallyArbiter/tree/master/listener_clients/relay-listener). For installation and use instructions, please check out that repository's [readme](https://github.com/josephdadams/TallyArbiter/blob/master/listener_clients/relay-listener/README.md).

## Using a GPO output

Lots of equipment support the use of GPIO (General Purpose In/Out) pins to interact. This could be for logic control, turning on LEDs, etc. A remote listening script that can run on a Raspberry Pi is available with the separate repository, [Tally Arbiter GPO Listener](https://github.com/josephdadams/TallyArbiter/tree/master/listener_clients/gpo-listener). For installation and use instructions, please check out that repository's [readme](https://github.com/josephdadams/TallyArbiter/blob/master/listener_clients/gpo-listener/README.md).

## Arduino ESP8266 with Neopixel

Use AdaFruit NeoPixel LED strips connected to an Arduino. Check out [NoahCallaway](http://github.com/noahcallaway/)'s repository for more information: https://github.com/NoahCallaway/TallyArbiter-arduino-neopixel

## TTGO_T Displays

Tally Arbiter can send tally data to an TTGO_T Display. A remote script is available in the separate repository, [Tally Arbiter TTGO_T Listener](https://github.com/josephdadams/TallyArbiter/tree/master/listener_clients/TTGO_T-listener). For installation and use instructions, please check out that repository's [readme](https://github.com/josephdadams/TallyArbiter/blob/master/listener_clients/TTGO_T-listener/README.md).

## VMix Tally Emulation

Tally Arbiter will also emulate a VMix server, which means you can use any compatible VMix tally client to view tally as well, such as the [VMix M5Stick Tally Light](https://github.com/guido-visser/vMix-M5Stick-Tally-Light) project by Guido Visser. Follow the instructions on that repository to set up your M5Stick device, and specify Tally Arbiter as your VMix server.

## Tally over NDI

Tally Arbiter can send out TSL 3.1 data via the `TSL 3.1 Clients` section. Paired with the [TSL NDI tally](https://github.com/iliessens/TSL-NDI-tally) software by [iliessens](https://github.com/iliessens), you can send live tally data to your NDI devices.
