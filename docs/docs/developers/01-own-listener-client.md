---
sidebar-position: 1
---

# Creating your own listener client

Tally Arbiter can send data over the socket.io protocol to your listener. You can make use of the following event emitters:

- `bus_options`: Send no arguments; Returns a `bus_options` event with an array of available busses (preview and program).
- `devices`: Send no arguments; Returns a `devices` event with an array of configured Tally Arbiter Devices.
- `device_listen`: Send a deviceId and a listener type (string); Returns a `device_states` event with an array of current device states for that device Id. This will add the listener client to the list in Tally Arbiter, making it manageable in the Settings interface.
- `device_states`: Send a deviceId as the argument; Returns a `device_states` event with an array of current device states for that device Id.
