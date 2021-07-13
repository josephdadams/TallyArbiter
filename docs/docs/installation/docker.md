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

Then, start it by typing `docker run -p 4455:4455 -v $(pwd)/config.json:/app/config.json tallyarbiter`.

**Be sure to mount your [config file](#configuration) using Docker volumes!**
