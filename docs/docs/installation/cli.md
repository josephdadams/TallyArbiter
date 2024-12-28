---
sidebar_position: 2
---

# CLI

## Installation

If you have Node.js and npm installed, you can install TallyArbiter as a CLI and run it from the command line or terminal using

```bash
npm install --global tallyarbiter
```

or in short: `npm i -g tallyarbiter`

Depending on your OS, you may need to run the command as root using the prefix "sudo".

```bash
sudo npm install --global tallyarbiter
```

Then, start it by typing `tallyarbiter`.

## Upgrading

To install the latest version, just run the same command from above (`npm i -g tallyarbiter`) again.

**Be sure to back up or save your [config file](../usage/control-interface.md#configuration)!**

## Running as a service

1. Open a terminal window and change directory to the folder where you placed the source code.
1. Install the Node.js library, `pm2`, by typing `npm install -g pm2`. This will install it globally on your system.
1. After `pm2` is installed, type `pm2 start tallyarbiter --name TallyArbiter` to daemonize it as a service.
1. If you would like it to start automatically upon bootup, type `pm2 save` and then `pm2 startup` and follow the instructions on-screen.
1. To view the console output while running the software with `pm2`, type `pm2 logs TallyArbiter`.
