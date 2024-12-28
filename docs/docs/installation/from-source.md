---
sidebar_position: 3
---

# Build and run from source

## Installation

To try out the latest features, you will likely need to build and run TallyArbiter from source. But no worries, it's very easy.

You must have Node.js installed. You can download it here: https://nodejs.org/en/download/

If you're on MacOS, you may also need to download and install XCode Command Line Tools.

Download the Tallly Arbiter source code. You can download it directly from GitHub, or you can use `git` from the command line to download the files.

To use `git`, you must have it installed: https://git-scm.com/book/en/v2/Getting-Started-Installing-Git

Type `git clone https://github.com/josephdadams/tallyarbiter` to download the source code. This will download to a subfolder of your current working folder.

After downloading the software, type `npm install` to install all necessary libraries and packages.

You can then start it by typing `npm start` in a terminal.

## Upgrading

If you downloaded the software using `git`, upgrades are simple. In the terminal window, change directly to the Tally Arbiter folder, and then type: `git pull`. This will download the latest source code.

If you downloaded the source code manually, just replace the files in the folder manually.

Now run `npm install` to make sure all packages are up to date.

**Be sure to back up or save your [config file](../usage/control-interface.md#configuration)!**
