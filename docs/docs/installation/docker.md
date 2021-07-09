---
sidebar_position: 2
---

# Docker
## Installation
If you have Docker installed, you can install TallyArbiter using our official Docker image [`insert Docker image name`](https://hub.docker.com/r/matteogheza/tallyarbitertestimage).
You can pull the image from DockerHub using the following command:
```bash
docker pull dockerimagename:latest
```

Then, start it by typing `docker run -p 4455:4455 dockerimagename`.
TODO: explain mounting config.json

**Be sure to mount your [config file](#configuration) using Docker volumes!**
