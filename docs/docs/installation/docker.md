---
sidebar_position: 2
---

# Docker

## Installation

If you have Docker installed, you can install TallyArbiter using our official Docker image [`TallyArbiter`](https://hub.docker.com/r/josephdadams/tallyarbiter).
You can pull the image from DockerHub using the following command:

```bash
docker pull josephdadams/tallyarbiter:latest
```

Then, start it by typing `docker run -d -p 4455:4455 -v $(pwd):/app/config --env APPDATA=/app/config --restart unless-stopped josephdadams/tallyarbiter`.
If you are using traditional Windows CMD, you can use `docker run -d -p 4455:4455 -v %CD%:/app/config --env APPDATA=/app/config --restart unless-stopped josephdadams/tallyarbiter`.
If you are using Powershell, you can use `docker run -d -p 4455:4455 -v $pwd:/app/config --env APPDATA=/app/config --restart unless-stopped josephdadams/tallyarbiter`.
If you prefer using docker-compose, you can use this configuration (change the `/home/pi` path to your directory of choice):

```yaml
version: '3.3'
services:
  tallyarbiter:
    ports:
      - '4455:4455'
    volumes:
      - /home/pi:/app/config
    environment:
      - APPDATA=/app/config
    restart: unless-stopped
    image: josephdadams/tallyarbiter
```

**Be sure to back up or save your [config file](../usage/control-interface.md#configuration)!**
