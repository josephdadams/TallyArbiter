---
sidebar_position: 5
---

# Configuring and Using Tally Arbiter Cloud

Tally Arbiter can send source, device, and tally data from a local instance within a closed network to an instance of Tally Arbiter on another network that may be more acccessible for end users. This is helpful if your users need to access Tally Arbiter and you don't want to have them tunnel or connect into your private network, or if users are located remotely.

- On the cloud server, create a new Cloud Key. This is like a password.
- On the local server, create a new Cloud Destination specifying the host, port, and cloud key. Multiple local servers can utilize the same cloud key.
- Once a connection is established, all sources, devices, and tally data from the local server will be relayed up to the cloud server.
- Tally Arbiter will handle this incoming tally data as it would any local source.
- You can also flash/ping listener clients the same way you would if they were local.
- **If a Tally Arbiter Cloud Client is removed, all Sources and Devices associated with that Cloud Client will be removed.**
