---
sidebar_position: 1
---

# Control Interface

TallyArbiter runs an HTTP server listening on port `4455`. If this port is in use and cannot be opened, you will receive an error.
To get to the web interface, open your browser to http://127.0.0.1:4455 if you're on the same machine where you're running the software. If not, just replace `127.0.0.1` with the IP of that machine.

If you're running the Desktop App, you get a window showing the GUI. However, the web interface is also available at the url described above.

## Configuration

In the configuration interface, the settings page is available at `/settings`: http://127.0.0.1:4455/settings
**This page is restricted by a username and password. On a new installation the username is `admin` and the password is `12345`, but that password only works for your very first sign-in: Tally Arbiter immediately asks you to choose your own, and the rest of the interface stays locked until you do.** Pick something you'll remember: there is no password reset link. If you do get locked out, close Tally Arbiter, set `"users": []` in the `config.json` described below, and start it again — the `admin` and `producer` accounts come back at `12345` and the rest of your configuration is left alone.

If you're upgrading an existing installation, your current passwords keep working. If any account is still on `12345`, Tally Arbiter says so at startup and on the Users tab of the settings page; change it under **Settings > Users**.

All the changes you make there are saved to a `config.json` file. This file should also be backed up frequently to prevent data loss when updating. It's path is different depending on the OS that you're running:

- Windows: `C:\Users\YourUsername\AppData\Roaming\TallyArbiter\config.json` or `%APPDATA%\TallyArbiter\config.json`
- MacOS: `~/Library/Preferences/TallyArbiter/config.json`
- Linux: `~/.local/share/TallyArbiter/config.json` or `/root/.local/share/TallyArbiter/config.json` (when using sudo)

You can also manually edit that file.

**Make sure that TallyArbiter is closed while making changes, because otherwise they will be overwritten!**

On the settings page can the settings be exported/imported to/from a file via the configuration interface.
