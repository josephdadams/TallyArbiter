# The build stage is pinned to the native runner architecture. Everything it
# emits (dist/, ui-dist/) is plain JavaScript and therefore identical for every
# target, so there is nothing to gain from repeating it once per platform under
# QEMU. Pinning also avoids two hard failures: electron is a devDependency and
# publishes no armv6 binary, and the Angular production build exhausts the
# 32-bit Node heap on arm/v6 and arm/v7.
FROM --platform=$BUILDPLATFORM node:24-alpine AS builder

ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION

# electron is only needed for the desktop build, never for the server or the UI
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1

WORKDIR /app

RUN apk add --no-cache git

COPY package.json package-lock.json tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
COPY UI ./UI

RUN npm ci
RUN npm run build
RUN cd UI && npm ci && npm run build


FROM node:24-alpine

ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION
ENV NODE_ENV=production

WORKDIR /app

RUN apk add --no-cache wget

COPY package.json package-lock.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/ui-dist ./ui-dist

# atem-connection depends on @julusian/freetype2, a required native module with
# no musl prebuilds, so it is compiled here against the target architecture.
# The toolchain is dropped again in the same layer to keep the image small.
# serialport (optional, via osc) compiles here too when the platform supports it.
RUN apk add --no-cache --virtual .build-deps alpine-sdk python3 \
	&& npm ci --omit=dev \
	&& apk del .build-deps

EXPOSE 4455 8099 5958

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4455/health || exit 1

CMD ["node", "dist/index.js"]
