---
sidebar_position: 2
---

# Sources

Sources represent all of the tally data that is generated. This is usually your video switcher or mixing software. Multiple sources can be added and they can all be different types.

The following source types are supported:

- Analog Way Livecore Image Processors
- Blackmagic ATEM
- Blackmagic VideoHub
- Grass Valley Contribution Tally
- Newtek Tricaster
- OBS Studio
- Open Sound Control (OSC)
- Panasonic AV-HS410
- Riedel SimplyLive
- Roland Smart Tally
- Roland VR-50HD-MKII
- Ross Carbonite/Carbonite Black/Carbonite Black Solo/Carbonite Ultra/Graphite
- Ross Vision (through GV Contribution Tally Protocol)
- StudioCoast VMix
- TSL 3.1/5.0 UDP/TCP (Ross switchers, Streamstar, FOR-A, etc. - any device that uses the TSL UMD protocol)

When you add a source and the connection to the tally source (video switcher, software, etc.) is successfully made, the source will be green. If there is an error, the source will be red. Look at the logs for more error information.

## Analog Way Livecore Image Processors

You will need the IP address of the device, and the port (standard port is 10600).

## Blackmagic ATEM

You will need the IP address of the ATEM. The ATEM can only have 5 simultaneous connections, so you may need to disconnect another connection in order for Tally Arbiter to connect to the ATEM.

## Blackmagic VideoHub

You will need the IP address of the VideoHub. You can choose to have any destination be configured as a preview bus, program bus, or both. Enter multiple destination routes by separating them with commas.

## Grass Valley Contribution Tally

It's an older protocol sir, but it checks out. Any Grass Valley switcher that uses this protocol. Choose whether the data is arriving via TCP or UDP, and the port you are sending data on.

## Newtek Tricaster

You will need the IP address of the Tricaster.

## OBS Studio

For OBS Studio v27 (or older) the `obs-websockets` plugin must be installed and configured in order for Tally Arbiter to connect. You can get the plugin here: https://github.com/Palakis/obs-websocket/releases.

For OBS Studio v28 and later is `obs-websockets` included with OBS Studio. Note that the included `obs-websockets` in OBS Studio uses port 4455. This will cause a port conflict with TallyArbiter. In OBS Studion can an alternative port be configured in Tools -> WebSocket Server Settings. An alternative is to re-configure Tally Aribiter with another port by editing the [config file](../../usage/control-interface.md).

You will need to supply the IP address, port, and password configured in the OBS Websockets plugin.

## Open Sound Control (OSC)

Incoming OSC data can be used to trigger device tally states. Configure the port as desired.

OSC paths must be one of the following:

- `/tally/preview_on`: Puts the device in Preview mode.
- `/tally/preview_off`: Turns off Preview mode for the device.
- `/tally/program_on`: Puts the device in Program mode.
- `/tally/program_off`: Turns off Program mode for the device.
- `/tally/previewprogram_on`: Puts the device in both Preview and Program mode.
- `/tally/previewprogram_off`: Turns off both Preview and Program Program mode for the device.

The device source address should be sent as an integer or a string. Send one argument of any type (integer, float, or string). If you send multiple arguments, they will be ignored.

## Panasonic AV-HS410

You will need the IP address of the switcher. Multicast must also be enabled on the switcher and your network in order to receive the tally data, therefore Tally Arbiter and the Panasonic device must reside on the same subnet.

## Riedel SimplyLive

You need to configure TSL in the SimplyLive backend to send the data to Tally Arbiter at the port you specify.
Uses an TSL v5 UDP connection internally.

## Roland Smart Tally

You will need the IP address of the Roland switcher.

## Roland VR-50HD-MKII

You will need the IP address of the Roland switcher.

## Ross Carbonite Models

You will need the IP address of the Ross Carbonite switcher. Your Carbonite must be configured to send the data to Tally Arbiter at the port you specify. All Ross products use the TSL 3.1/5.0 protocols, however this specific source type allows you to process tally information by specific supported busses (ME1, MME1, Auxes, etc.) regardless of the "OnAir" setting that is configured on the Carbonite itself.

## Ross Vision (through Contrib Tally)

Some of Ross's older Vision models use the Contribution Tally protocol instead of TSL.

## StudioCoast VMix

You will need the IP address of the computer running VMix.

## TSL 3.1 UDP/TCP

Your switcher or service that uses this protocol must be configured to send the data to Tally Arbiter at the port you specify.
