# Getting started!

Tally Arbiter is designed to receive or obtain tally data from multiple sources and then arbitrate whether a given device is considered to be in Preview or Program.

## Sources

They represent all of the tally data that is generated. This is usually your video switcher or mixing software. Multiple sources can be added and they can all be different types. The following source types are currently supported:

*   TSL 3.1 UDP/TCP (Ross switchers, etc.)
*   Blackmagic ATEM
*   OBS Studio
*   StudioCoast VMix
*   Roland Smart Tally
*   Newtek Tricaster
*   Open Sound Control (OSC)

When you add a source and the connection to the tally source (video switcher, software, etc.) is successfully made, the source will be green. If there is an error, the source will be red. Look at the logs for more error information.

## Devices

They represent your inputs (like cameras) that you want to track with tally data. Devices can be assigned different addresses or inputs by each source. In Tally Arbiter, you can create as many devices as you would like and give each one a helpful name and description.

## Mapping Source data to Devices:

In order to associate tally data with a device, you must assign the source addresses to each device. These addresses can vary from source to source, so they must be manually assigned.

For example, a Camera can be connected to a `Blackmagic ATEM` on `Input 1`, but connected to an `OBS Studio` on `Scene 2`. Tally Arbiter will track the tally data from each source and arbitrate whether the device is ultimately in preview or program (or both) by aggregating all of the source data together.

To assign a Source to a Device, click "Device Sources" next to a Device in the list. Choose the enabled Source from the drop down list, and click "Add".

**A Note About Addresses**

The source address is typically the actual input number on the switcher. So, if your camera on your ATEM comes in on Input 5, just enter `5`. However, if you're using a source like OBS Studio, your address might be a string, like `Scene 2`.  

**Running Actions when Devices reach a certain tally state:**  
Once a device is assigned to a source(s), if a matching condition is met, an action can be performed. You can specify whether the action should be run when the device is entering a bus or leaving a bus, which is helpful for bus-specific actions like operating a relay. Multiple actions are supported per device and per bus (preview and program).

*   TSL 3.1 UDP or TCP
*   Outgoing Webhook
*   Local Console Output/Logging
*   Open Sound Control (OSC)

Device Actions can only be run once when the device state enters or exits that bus. This is to prevent actions from being run continuously if tally data is received in chunks. To run an action again, a device must change state on that specific bus (Preview or Program) before it can be run again.  

**Configuring and Using Tally Arbiter Cloud**  
Tally Arbiter can send source, device, and tally data from a local instance within a closed network to an instance of Tally Arbiter on another network that may be more accessible for end users. This is helpful if your users need to access Tally Arbiter and you don't want to have them tunnel or connect into your private network, or if users are located remotely.

*   On the cloud server, create a new Cloud Key. This is like a password.
*   On the local server, create a new Cloud Destination specifying the host, port, and cloud key. Multiple local servers can utilize the same cloud key.
*   Once a connection is established, all sources, devices, and tally data from the local server will be relayed up to the cloud server.
*   Tally Arbiter will handle this incoming tally data as it would any local source.
*   You can also flash/ping listener clients the same way you would if they were local.
*   **If a Tally Arbiter Client is removed, all Sources and Devices will be removed.**