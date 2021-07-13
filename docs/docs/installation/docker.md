---
sidebar_position: 2
---

# Docker
## Installation
If you have Docker installed, you can install TallyArbiter using our official Docker image [`TallyArbiter`](https://hub.docker.com/r/josephdadams/tallyarbiter).
You can pull the image from DockerHub using the following command:
```bash
docker pull tallyarbiter:latest
```

Then, start it by typing `docker run -p 4455:4455 -v $(pwd)/config.json:/app/config.json --restart unless-stopped tallyarbiter`.
If you are using traditional Windows CMD, you can use `docker run -p 4455:4455 -v %CD%\config.json:/app/config.json --restart unless-stopped tallyarbiter`.
If you are using Powershell, you can use `docker run -p 4455:4455 -v $pwd\config.json:/app/config.json --restart unless-stopped tallyarbiter`.
If you prefer using docker-compose, you can use this configuration:
```yaml
version: '3.3'
services:
    tallyarbiter:
        ports:
            - '4455:4455'
        volumes:
            - './config.json:/app/config.json'
        restart: unless-stopped
        image: tallyarbiter
```

**Be sure to mount your [config file](#configuration) using Docker volumes!**
