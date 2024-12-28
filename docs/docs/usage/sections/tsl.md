---
sidebar_position: 4
---

# TSL 3.1 Protocol Conversion

Tally Arbiter can automatically send out TSL 3.1 data to any number of clients. This is helpful if you want to have Tally Arbiter aggregate all of your tally data and then send out updates to UMDs, multiviewers, etc.

- Each device must have a TSL Address configured. **The default TSL address is `0`, so be sure to change the device's TSL address to something other than `0`, or it will not be sent to the connected clients.**
- Add a TSL Client by using the "TSL Clients" configuration area in the Settings interface.
- Specify the IP address, Port, and Transport Type (UDP or TCP).
- Tally Arbiter will send TSL 3.1 data to these clients any time a device changes state.

## Tally over NDI

Paired with the [TSL NDI tally](https://github.com/iliessens/TSL-NDI-tally) software by [iliessens](https://github.com/iliessens), you can send live tally data to your NDI devices.
