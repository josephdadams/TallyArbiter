---
sidebar_position: 2
---

# Devices
Devices represent your inputs (like cameras) that you want to track with tally data. Devices can be assigned different addresses or inputs by each source. In Tally Arbiter, you can create as many devices as you would like and give each one a helpful name and description.

## Device Sources
In order to assciate tally data with a device, you must assign the source addresses to each device. These addresses can vary from source to source, so they must be manually assigned.

For example, a Camera can be connected to a `Blackmagic ATEM` on `Input 1`, but connected to an `OBS Studio` on `Scene 2`. Tally Arbiter will track the tally data from each source and arbitrate whether the device is ultimately in preview or program (or both) by aggregating all of the source data together.

To assign a Source to a Device, click "Device Sources" next to a Device in the list. Choose the enabled Source from the drop down list, type in the address, and click Add.

### Linking Device Sources
Device Sources can be "linked" on either the Preview Bus, the Program Bus, or both. If linked, this means that a Device is not considered to be active in that Bus unless Tally Arbiter has determined that the Device is active in that Bus **across all Sources** assigned to that Device.

### A Note About Addresses
The source address is typically the actual input number on the switcher. So, if your camera on your ATEM comes in on Input 5, just enter `5`. However, if you're using a source like OBS Studio, your address might be a string, like `Scene 2` or `Image 1`. Some Source Types also support selecting the Device Address via a list.

## Device Actions
Once a device is assigned to a source(s), if a matching condition is met, an action can be performed. You can specify whether the action should be run when the device is entering a bus or leaving a bus, which is helpful for bus-specific actions like operating a relay. Multiple actions are supported per device and per bus (preview and program).

The following Device Actions are implemented:
* TSL 3.1 UDP/TCP
* TSL 5.0 UDP/TCP
* Outgoing Webhook
* Generic TCP
* Local Console Output/Logging (useful for testing)
* Open Sound Control (OSC) (multiple arguments supported)

Device Actions can only be run once when the device state enters or exits that bus. This is to prevent actions from being run continuously if tally data is received in chunks. To run an action again, a device must change state on that specific bus (Preview or Program) before it can be run again.
