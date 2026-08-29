---
sidebar_position: 2
---

# Sources

Sources represent all of the tally data that is generated. This is usually your video switcher or mixing software. Multiple sources can be added and they can all be different types.

The following source types are supported:

- Analog Way Livecore Image Processors
- Analog Way LivePremier / Aquilon
- Blackmagic ATEM
- Blackmagic VideoHub
- Grass Valley Contribution Tally
- Newtek Tricaster
- OBS Studio
- Open Sound Control (OSC)
- Panasonic AV-HS410
- Pixelhue Q8
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

## Analog Way LivePremier / Aquilon

For LivePremier and Aquilon processors (the AWJ platform), running firmware 6.1.60 or later. You will need the IP address of the device and the port used by its Web RCS, which is usually 80. Source addresses are the input number.

Program and preview tally are read directly from each input's on-air state, which the device already unions across every screen and aux, so any input routed to program or preview on any output will tally. Note that this reflects routing rather than on-screen visibility: an input assigned to a layer that is currently hidden (for example at zero opacity) still reports as on program or preview, matching what the device's own Web RCS shows.

The device only pushes tally changes, not a snapshot on connect, so an input that is already on program or preview when Tally Arbiter connects will tally on its next program or preview change.

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

Community project: [GPI-to-OSC](https://github.com/simply-Gamic/GPI-to-OSC) converts GPI tally outputs from older/incompatible video switchers into OSC messages using a Raspberry Pi (or ESP32), allowing them to be used as a Tally Arbiter source wirelessly.

## Panasonic AV-HS410

You will need the IP address of the switcher. Multicast must also be enabled on the switcher and your network in order to receive the tally data, therefore Tally Arbiter and the Panasonic device must reside on the same subnet.

## Pixelhue Q8

You will need the IP address of the processor and its API port, which is 8088. No password is required.

Source addresses are the connector's position, written as the device writes it: `In 1-11` is card 1, port 11. Inputs are offered by name and position together, so a connector named `Cam 1` on that port is listed as `Cam 1 (In 1-11)`, while one left with its default name appears simply as `In 1-11`. Cards and ports are numbered from 1 as they are on the device, where each input card carries twelve ports — 1 to 4 HDMI, 5 to 8 DisplayPort, 9 to 12 12G-SDI — of which eight may be in use at once.

Addressing by position rather than by name means renaming a connector on the device does not break an existing device source; the tally follows whatever is plugged into that port.

The Q8 has no tally or UMD protocol, so tally is derived from its layer model. An input is on program when an enabled layer carries it on the program scene of a screen being followed, and on preview when the same is true of the preview scene. Because a screen can show several layers at once, more than one input can be on program simultaneously, which is normal for a multi-box or picture-in-picture layout.

Leave **Screens** blank to follow every screen, or list the screens that should drive tally by name or number, separated by commas, for example `Portrait HL, Portrait HR`. The multiviewer is never followed, whether or not it is listed, because every input is present on it permanently and following it would put the entire rack on program.

During a fade, both the outgoing and the incoming inputs are reported on program for as long as the transition lasts. An input fading in is on screen from the moment the fade begins, so its tally lights then rather than when the fade finishes, and an input fading out keeps its tally until the fade is complete. A cut has no such window and takes effect immediately.

Tally reflects whether a layer is enabled rather than whether it is ultimately visible, so an input on an enabled layer that happens to sit behind another layer still reports as on program.

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
